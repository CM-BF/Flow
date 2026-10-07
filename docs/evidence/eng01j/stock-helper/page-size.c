#define _DARWIN_C_SOURCE 1
#include <errno.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
    alarm(2);
    errno = 0;
    long configured = sysconf(_SC_PAGESIZE);
    int configured_error = errno;
    errno = 0;
    int direct = getpagesize();
    int direct_error = errno;
    printf("{\"sysconf\":%ld,\"sysconfErrno\":%d,\"getpagesize\":%d,\"getpagesizeErrno\":%d}\n",
           configured, configured_error, direct, direct_error);
    return 0;
}
