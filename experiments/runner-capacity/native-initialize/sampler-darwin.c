/* Private bounded libproc helper. No signals, paths, argv/environment inspection or cleanup authority.
 * Compile/link only in this preparation; helper execution is NOT authorized. */
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/resource.h>
#include <mach/mach_time.h>
#include <unistd.h>
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MEMBERS 32
#define ROW_BYTES 256
#define TOTAL_BYTES 524288
struct metric { pid_t pid, ppid, pgid; uint64_t start, user, system, rss, t0, t1; };
static void clear_private(void *p, size_t n) { volatile unsigned char *b = p; while (n--) *b++ = 0; }
static int read_metric(pid_t pid, uint64_t expected, struct metric *out) {
  struct rusage_info_v0 a = {0}, b = {0}; struct proc_bsdshortinfo info = {0};
  out->t0 = mach_absolute_time();
  if (proc_pid_rusage(pid, RUSAGE_INFO_V0, (rusage_info_t *)&a) != 0) return 0;
  int size = proc_pidinfo(pid, PROC_PIDT_SHORTBSDINFO, 0, &info, sizeof(info));
  /* pbsi_comm is an unavoidable ABI field, never decoded, output or persisted. */
  pid_t actual = (pid_t)info.pbsi_pid, parent = (pid_t)info.pbsi_ppid, group = (pid_t)info.pbsi_pgid;
  clear_private(&info, sizeof(info));
  if (size != (int)sizeof(struct proc_bsdshortinfo) || actual != pid || parent <= 0 || group <= 0
      || proc_pid_rusage(pid, RUSAGE_INFO_V0, (rusage_info_t *)&b) != 0) return 0;
  if (!a.ri_proc_start_abstime || a.ri_proc_start_abstime != b.ri_proc_start_abstime
      || (expected && expected != b.ri_proc_start_abstime) || b.ri_proc_exit_abstime) return 0;
  out->pid = pid; out->ppid = parent; out->pgid = group; out->start = b.ri_proc_start_abstime;
  out->user = b.ri_user_time; out->system = b.ri_system_time; out->rss = b.ri_resident_size;
  out->t1 = mach_absolute_time(); return 1;
}
static int census(pid_t root, uint64_t expected, struct metric rows[MEMBERS], size_t *count) {
  if (!read_metric(root, expected, &rows[0])) return 0;
  *count = 1;
  for (size_t i = 0; i < *count; ++i) {
    pid_t children[MEMBERS + 1] = {0}; struct metric parent_after;
    errno = 0;
    int bytes = proc_listpids(PROC_PPID_ONLY, (uint32_t)rows[i].pid, children, sizeof(children));
    if (bytes < 0 || errno || bytes % (int)sizeof(pid_t) || bytes >= (int)sizeof(children)) return 0;
    for (size_t j = 0; j < (size_t)bytes / sizeof(pid_t); ++j) {
      if (children[j] <= 0 || *count >= MEMBERS) return 0;
      for (size_t k = 0; k < *count; ++k) if (rows[k].pid == children[j]) return 0;
      if (!read_metric(children[j], 0, &rows[*count]) || rows[*count].ppid != rows[i].pid) return 0;
      ++*count;
    }
    if (!read_metric(rows[i].pid, rows[i].start, &parent_after) || parent_after.ppid != rows[i].ppid
        || parent_after.pgid != rows[i].pgid) return 0;
  }
  return 1;
}
int main(void) {
  /* One long-lived direct child of the owned coordinator, not arbitrary PID input. */
  pid_t root = getppid(); uint64_t identity = 0; size_t written = 0; unsigned ordinal = 0;
  mach_timebase_info_data_t base = {0};
  if (root <= 1 || mach_timebase_info(&base) != KERN_SUCCESS || !base.numer || !base.denom) return 2;
  char command[16];
  while (fgets(command, sizeof(command), stdin)) {
    if (strcmp(command, "sample\n") || ++ordinal > 64 || getppid() != root) return 2;
    struct metric rows[MEMBERS]; size_t count = 0; uint64_t begin = mach_absolute_time();
    if (!census(root, identity, rows, &count)) { fputs("{\"kind\":\"unknown\"}\n", stdout); fflush(stdout); return 2; }
    identity = rows[0].start; uint64_t end = mach_absolute_time();
    char encoded[MEMBERS][ROW_BYTES + 1], header[256]; size_t needed = 0;
    for (size_t i = 0; i < count; ++i) {
      struct metric *r = &rows[i];
      int n = snprintf(encoded[i], sizeof(encoded[i]), "{\"pid\":%d,\"ppid\":%d,\"pgid\":%d,\"start\":\"%" PRIu64 "\",\"user\":\"%" PRIu64 "\",\"system\":\"%" PRIu64 "\",\"rss\":\"%" PRIu64 "\",\"t0\":\"%" PRIu64 "\",\"t1\":\"%" PRIu64 "\"}\n", r->pid,r->ppid,r->pgid,r->start,r->user,r->system,r->rss,r->t0,r->t1);
      if (n < 1 || n > ROW_BYTES) return 2;
      needed += (size_t)n;
    }
    int n = snprintf(header, sizeof(header), "{\"kind\":\"sample\",\"ordinal\":%u,\"begin\":\"%" PRIu64 "\",\"end\":\"%" PRIu64 "\",\"numer\":\"%u\",\"denom\":\"%u\",\"count\":%zu}\n",ordinal,begin,end,base.numer,base.denom,count);
    if (n < 1 || n >= (int)sizeof(header) || written + needed + (size_t)n > TOTAL_BYTES) return 2;
    if (fputs(header, stdout) < 0) return 2;
    for (size_t i = 0; i < count; ++i) if (fputs(encoded[i], stdout) < 0) return 2;
    if (fflush(stdout)) return 2;
    written += needed + (size_t)n;
  }
  return ferror(stdin) ? 2 : 0;
}
