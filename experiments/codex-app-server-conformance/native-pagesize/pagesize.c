/* One fixed observation; no thread creation, mmap, environment reads, or stdio output. */
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/sysctl.h>
#include <unistd.h>

static bool valid_nonce(const char *nonce) {
  if (strlen(nonce) != 32) return false;
  for (size_t i = 0; i < 32; i++) {
    if (!((nonce[i] >= '0' && nonce[i] <= '9') ||
          (nonce[i] >= 'a' && nonce[i] <= 'f'))) return false;
  }
  return true;
}

int main(int argc, char **argv) {
  if (argc != 3 || argv[1][0] != '/' || !valid_nonce(argv[2])) return 64;
  const int report = open(argv[1], O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (report < 0) return 65;
  if (report < 3) { close(report); return 66; }

  errno = 0;
  const long sysconf_page = sysconf(_SC_PAGESIZE);
  const int sysconf_errno = errno;
  errno = 0;
  const int cached_page = getpagesize();
  const int getpagesize_errno = errno;

  int mib[2] = { CTL_HW, HW_PAGESIZE };
  int direct_page = 0;
  size_t direct_length = sizeof(direct_page);
  errno = 0;
  const int direct_result = sysctl(mib, 2, &direct_page, &direct_length, NULL, 0);
  const int direct_errno = errno;

  const pthread_t self = pthread_self();
  errno = 0;
  const size_t stack_size = pthread_get_stacksize_np(self);
  const int stack_size_errno = errno;
  errno = 0;
  const void *stack_address = pthread_get_stackaddr_np(self);
  const int stack_address_errno = errno;

  /* errno is an observation, not a pthread failure contract. No page-value arithmetic occurs. */
  char direct_value[32] = "null";
  if (direct_result == 0 && direct_length == sizeof(direct_page)) {
    snprintf(direct_value, sizeof(direct_value), "%d", direct_page);
  }
  char line[2048];
  const int length = snprintf(line, sizeof(line),
    "{\"protocol\":\"flow.pagesize.v1\",\"nonce\":\"%s\",\"pid\":%ld,"
    "\"sysconf\":{\"value\":%ld,\"errno\":%d},"
    "\"getpagesize\":{\"value\":%d,\"errno\":%d},"
    "\"sysctl\":{\"result\":%d,\"value\":%s,\"length\":%zu,\"expectedLength\":%zu,\"errno\":%d},"
    "\"pthread\":{\"stackSize\":%zu,\"stackSizeErrno\":%d,\"stackAddressPresent\":%s,\"stackAddressErrno\":%d},"
    "\"complete\":true}\n",
    argv[2], (long)getpid(), sysconf_page, sysconf_errno, cached_page, getpagesize_errno,
    direct_result, direct_value, direct_length, sizeof(direct_page), direct_errno,
    stack_size, stack_size_errno, stack_address != NULL ? "true" : "false", stack_address_errno);
  int result = 0;
  if (length <= 0 || (size_t)length >= sizeof(line)) result = 70;
  else if (write(report, line, (size_t)length) != length) result = 71;
  else if (fsync(report) != 0) result = 72;
  const int close_result = close(report);
  return result != 0 ? result : (close_result == 0 ? 0 : 73);
}
