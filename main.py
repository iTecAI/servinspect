from json.decoder import JSONDecodeError
from os import name
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import psutil
import json
import logging
import uvicorn
from socket import *
import os
from concurrent.futures import ThreadPoolExecutor
import math
import threading
import time
import traceback

LOCK = False

def ip():
    return gethostbyname(gethostname())


with open('server.json', 'r') as f:
    cfg = json.load(f)
if type(logging.getLevelName(cfg['logLevel'].upper())) == int:
    logging.basicConfig(format='%(filename)s:%(lineno)s:%(levelname)s @ %(asctime)s > %(message)s',
                        level=logging.getLevelName(cfg['logLevel'].upper()))
else:
    logging.basicConfig(
        format='%(filename)s:%(lineno)s:%(levelname)s @ %(asctime)s > %(message)s', level=0)

app = FastAPI()
app.mount('/static', StaticFiles(directory='web'), name='static')


@app.get('/')
async def get_root():
    return FileResponse(path=os.path.join('web', 'index.html'))


def proc_family(family):
    if family == AF_INET:
        return 'IPv4'
    if family == AF_INET6:
        return 'IPv6'
    return 'unix'


def proc_type(typ):
    if typ == SOCK_STREAM:
        return 'tcp'
    if typ == SOCK_DGRAM:
        return 'udp'
    return 'sequential'


def get_proc_info(pid):
    try:
        p = psutil.Process(pid=pid)
        with p.oneshot():
            dct = {
                'pid': p.ppid(),
                'name': p.name(),
                'status': p.status(),
                'create_time': p.create_time(),
                'cwd': p.cwd().replace('\\', '/'),
                'ram_percent': p.memory_percent()*100,
                'connections': []
            }
        return dct
    except:
        return None


def status_loop():
    global LOCK
    while True:
        connections = [{
            'family': proc_family(c.family),
            'type': proc_type(c.type),
            'local': c.laddr,
            'remote': c.raddr,
            'status': c.status,
            'pid': c.pid
        } for c in psutil.net_connections(kind='all')]
        with ThreadPoolExecutor(max_workers=16) as executor:
            results = {i: executor.submit(get_proc_info, i)
                       for i in psutil.pids()}
        procs = [results[i].result() for i in results.keys()]
        procs = {i['pid']: i for i in procs if i != None}
        PROCESSES = procs.copy()
        for c in connections:
            if c['pid'] in PROCESSES.keys():
                PROCESSES[c['pid']]['connections'].append(c.copy())
        
        LOCK = True
        with open('last_processes.json', 'w') as f:
            f.write(json.dumps(PROCESSES))
        time.sleep(0.1)
        LOCK = False
        time.sleep(1)


@app.get('/status/')
async def get_status():
    ram = psutil.virtual_memory()
    cpu = {
        'speed': psutil.cpu_freq().current,
        'usage': psutil.cpu_percent()
    }
    ram_perc = 100 - ((ram.available / ram.total) * 100.0)
    disk = {name: psutil.disk_usage(cfg['diskPaths'][name])
            for name in cfg['diskPaths'].keys()}
    netsent = psutil.net_io_counters().bytes_sent
    netrecv = psutil.net_io_counters().bytes_recv
    return {
        'cpu': cpu,
        'ram': ram_perc,
        'disk': disk,
        'net': {
            'sent': netsent,
            'recv': netrecv
        }
    }

@app.get('/status/processes')
async def get_processes():
    global LOCK
    while LOCK:
        pass
    while True:
        try:
            with open('last_processes.json', 'r') as f:
                return json.loads(f.read())
        except JSONDecodeError:
            pass

if __name__ == "__main__":
    try:
        logging.info('Starting status update thread.')

        threading.Thread(target=status_loop, daemon=True).start()

        logging.info('Waiting until status is populated.')
        while not os.path.exists('last_processes.json'):
            pass

        time.sleep(5)

        logging.info(f'Running at 0.0.0.0:{str(cfg["serverPort"])}')
        uvicorn.run('main:app', host='0.0.0.0',
                    port=cfg['serverPort'], access_log=False, log_level="info")
    except:
        with open('error.txt', 'w') as f:
            f.write(traceback.format_exc())
