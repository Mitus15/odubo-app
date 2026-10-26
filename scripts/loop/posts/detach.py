"""Run a command in its own session, low priority, output to a log: it survives the app closing."""
import os, sys
log, cmd = sys.argv[1], sys.argv[2:]
if os.fork() == 0:
    os.setsid()
    fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.dup2(fd, 1); os.dup2(fd, 2)
    nul = os.open(os.devnull, os.O_RDONLY); os.dup2(nul, 0)
    os.execvp("caffeinate", ["caffeinate", "-i", "nice", "-n", os.environ.get("NICE", "10"), *cmd])
