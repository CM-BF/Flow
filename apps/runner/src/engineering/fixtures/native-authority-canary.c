/* Only host-created scratch paths; no provider, credentials or user services. */
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <sys/wait.h>
#include <unistd.h>

static void result(const char *name, long value, int error) {
  printf("{\"name\":\"%s\",\"value\":%ld,\"errno\":%d}\n", name, value, error);
  fflush(stdout);
}
static void write_path(const char *name, const char *path) {
  errno = 0;
  int fd = open(path, O_WRONLY | O_NOFOLLOW);
  int error = errno;
  if (fd < 0) { result(name, fd, error); return; }
  errno = 0; ssize_t n = write(fd, "X", 1); error = errno;
  close(fd); result(name, n, error);
}
static int protocol(const char *descriptor) {
  alarm(3);
  char input[4096];
  if (!fgets(input,sizeof input,stdin) || !strstr(input,"initialize")) return 70;
  puts("{\"id\":1,\"result\":{\"userAgent\":\"flow-own-canary\",\"platformFamily\":\"unix\",\"platformOs\":\"macos\",\"codexHome\":\"own-canary\"}}");
  fflush(stdout);
  if (!fgets(input,sizeof input,stdin) || !strstr(input,"initialized")) return 71;
  errno=0;long inherited=write(atoi(descriptor),"F",1);int inherited_error=errno;
  errno=0;int fd=open("calculator.mjs",O_WRONLY|O_NOFOLLOW);long allowed=-1;
  if(fd>=0){allowed=write(fd,"X",1);close(fd);}
  errno=0;fd=open("baseline.txt",O_WRONLY|O_NOFOLLOW);int denied_error=errno;
  if(fd>=0)close(fd);
  printf("{\"method\":\"canary/result\",\"params\":{\"pid\":%ld,\"inheritedWrite\":%ld,\"inheritedErrno\":%d,\"allowedWrite\":%ld,\"deniedOpen\":%d,\"deniedErrno\":%d}}\n",(long)getpid(),inherited,inherited_error,allowed,fd,denied_error);
  fflush(stdout);
  while(fgets(input,sizeof input,stdin)) { /* Host closes the same R06 handle. */ }
  return 0;
}
int main(int argc, char **argv) {
  if (argc == 3 && strcmp(argv[1],"app-server") == 0) return protocol(argv[2]);
  if (argc != 4) return 64;
  alarm(3);
  const char *root = argv[1];
  char allowed[4096], denied[4096], made[4096], renamed[4096], sock_path[104];
  if (snprintf(allowed,sizeof allowed,"%s/calculator.mjs",root) >= (int)sizeof allowed ||
      snprintf(denied,sizeof denied,"%s/baseline.txt",root) >= (int)sizeof denied ||
      snprintf(made,sizeof made,"%s/extra",root) >= (int)sizeof made ||
      snprintf(renamed,sizeof renamed,"%s/renamed",root) >= (int)sizeof renamed ||
      snprintf(sock_path,sizeof sock_path,"%s/delegate.sock",root) >= (int)sizeof sock_path) return 65;
  result("entered", getpid(), 0);
  if (strcmp(argv[2],"fd") == 0) {
    int fd = atoi(argv[3]); errno = 0;
    ssize_t n = write(fd, "F", 1); result("inheritedWrite", n, errno);
    result("complete", 1, 0); return 0;
  }
  write_path("allowedWrite", allowed); write_path("deniedWrite", denied);
  if (strcmp(argv[2],"control") != 0) {
  errno = 0; int fd = open(made,O_CREAT|O_EXCL|O_WRONLY,0600); int error=errno;
  result("create",fd,error); if(fd>=0)close(fd);
  errno = 0; int rc = link(denied,renamed); result("hardlink",rc,errno);
  errno = 0; rc = symlink(denied,made); result("symlink",rc,errno);
  errno = 0; rc = rename(allowed,renamed); result("rename",rc,errno);
  errno = 0; rc = unlink(denied); result("unlink",rc,errno);
  }
  errno = 0; pid_t pid = fork(); int error=errno;
  if(pid==0)_exit(0);
  result("fork",pid,error); if(pid>0)waitpid(pid,NULL,0);
  int rc; errno = 0; int channel = socket(AF_UNIX,SOCK_STREAM,0); error=errno;
  if(channel<0)result("delegate",channel,error);
  else {
    struct sockaddr_un address={0};address.sun_family=AF_UNIX;
    memcpy(address.sun_path,sock_path,strlen(sock_path)+1);
    errno=0;rc=connect(channel,(struct sockaddr*)&address,sizeof address);error=errno;
    result("delegate",rc,error);if(rc==0)write(channel,"D",1);close(channel);
  }
  if (strcmp(argv[2],"control") == 0) { result("complete",1,0); return 0; }
  result("beforeOtherExec",1,0);
  char *const args[]={"true",NULL}; char *const env[]={NULL};
  errno=0; execve("/usr/bin/true",args,env);result("otherExec",-1,errno);
  result("complete",1,0);return 0;
}
