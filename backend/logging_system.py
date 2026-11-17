from functools import wraps
from datetime import datetime

logging_filename = 'Log.log'


def _client_ip(args, kwargs) -> str:
    for value in (*args, *kwargs.values()):
        client = getattr(value, "client", None)
        host = getattr(client, "host", None)
        if host:
            return host
    return "unknown"


def _log(level: str, msg: str):
    def deco(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            with open(logging_filename, 'a', encoding='utf-8') as output:
                output.write(f'<{level} {now_str}> <IP {_client_ip(args, kwargs)}> {msg}\n')
            return func(*args, **kwargs)
        return wrapper
    return deco


def log_err(msg: str):
    return _log("ERROR", msg)


def log_warn(msg: str):
    return _log("WARNING", msg)


def log_info(msg: str):
    return _log("INFO", msg)


def log_debug(msg: str):
    return _log("DEBUG", msg)

