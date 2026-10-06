/* WPF-MATURE-02: proposal only. No stdio communication or Node initialization. */
#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define REPORT_LIMIT 4096u
#define LINE_LIMIT 512u

static const char *error_name(int error) {
  switch (error) {
    case 0: return "null";
    case EPERM: return "\"EPERM\"";
    case EACCES: return "\"EACCES\"";
    case EBADF: return "\"EBADF\"";
    case EINTR: return "\"EINTR\"";
    default: return "\"OTHER\"";
  }
}

static const char *file_kind(mode_t mode) {
  if (S_ISSOCK(mode)) return "socket";
  if (S_ISFIFO(mode)) return "fifo";
  if (S_ISREG(mode)) return "regular";
  if (S_ISCHR(mode)) return "character";
  return "other";
}

static bool nonce_valid(const char *nonce) {
  if (strlen(nonce) != 32) return false;
  for (size_t i = 0; i < 32; i++) {
    if (!((nonce[i] >= '0' && nonce[i] <= '9') ||
          (nonce[i] >= 'a' && nonce[i] <= 'f'))) return false;
  }
  return true;
}

/* No unbounded retry, error strings, environment, or file contents enter the report. */
static int emit_record(int report, const char *line, int length, size_t *total) {
  if (length <= 0 || (size_t)length >= LINE_LIMIT ||
      *total + (size_t)length > REPORT_LIMIT) return 70;
  if (write(report, line, (size_t)length) != length) return 71;
  *total += (size_t)length;
  return fsync(report) == 0 ? 0 : 72;
}

static int report_fd(int report, int fd, size_t *total) {
  struct stat metadata;
  errno = 0;
  const int stat_result = fstat(fd, &metadata);
  const int stat_error = errno;
  errno = 0;
  const int flags = fcntl(fd, F_GETFL);
  const int flags_error = errno;
  const char *access = "unknown";
  if (flags >= 0) {
    switch (flags & O_ACCMODE) {
      case O_RDONLY: access = "read-only"; break;
      case O_WRONLY: access = "write-only"; break;
      case O_RDWR: access = "read-write"; break;
      default: break;
    }
  }
  char line[LINE_LIMIT];
  const int length = snprintf(line, sizeof(line),
    "{\"record\":\"fd\",\"fd\":%d,\"fstat\":{\"ok\":%s,\"result\":%d,\"errno\":%s,\"errnoNumber\":%d,\"kind\":\"%s\"},"
    "\"fcntl\":{\"ok\":%s,\"result\":%d,\"errno\":%s,\"errnoNumber\":%d,\"access\":\"%s\",\"nonblocking\":%s}}\n",
    fd, stat_result == 0 ? "true" : "false", stat_result, error_name(stat_error), stat_error,
    stat_result == 0 ? file_kind(metadata.st_mode) : "unknown",
    flags >= 0 ? "true" : "false", flags, error_name(flags_error), flags_error, access,
    flags < 0 ? "null" : ((flags & O_NONBLOCK) ? "true" : "false"));
  return emit_record(report, line, length, total);
}

int main(int argc, char **argv) {
  if (argc != 3 || !nonce_valid(argv[2])) return 64;
  /* Host supplies one exact absent path under its inode-verified owned state directory. */
  const int report = open(argv[1], O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (report < 0) return 65;
  if (report < 3) { close(report); return 66; } // Never replace a missing measured stdio descriptor.
  size_t total = 0;
  char line[LINE_LIMIT];
  int length = snprintf(line, sizeof(line),
    "{\"record\":\"start\",\"protocol\":\"flow.fd-canary.v1\",\"nonce\":\"%s\",\"pid\":%ld}\n",
    argv[2], (long)getpid());
  int result = emit_record(report, line, length, &total);
  for (int fd = 0; fd < 3 && result == 0; fd++) result = report_fd(report, fd, &total);
  if (result == 0) {
    length = snprintf(line, sizeof(line), "{\"record\":\"complete\",\"count\":3}\n");
    result = emit_record(report, line, length, &total);
  }
  const int close_result = close(report);
  return result != 0 ? result : (close_result == 0 ? 0 : 73);
}
