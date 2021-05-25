from fastapi import APIRouter, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import docker
import docker.errors
import json
import time
import multiprocessing

router = APIRouter()

def client():
    return docker.client.from_env()

def cfg():
    with open('server.json', 'r') as f:
        cfg = json.load(f)
    return cfg

@router.get('/')
async def get_commander_root():
    return FileResponse(path=os.path.join('web', 'commander.html'))

@router.get('/containers')
async def list_containers():
    return {c.id: {
        'id': c.id,
        'short_id': c.short_id,
        'name': c.name,
        'status': c.status,
        'labels': c.labels
    } for c in client().containers.list()}

@router.get('/containers/{cid}')
async def get_container_info(cid: str, response: Response):
    conts = client().containers.list()
    for i in conts:
        if i.id == cid or i.short_id == cid:
            return {
                'id': i.id,
                'short_id': i.short_id,
                'name': i.name,
                'status': i.status,
                'labels': i.labels,
                'attrs': i.attrs
            }
    response.status_code = 404
    return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}

@router.get('/repositories')
async def get_local_repositories():
    return os.listdir(cfg()['localDockerDirectory'])

class RenameRequestModel(BaseModel):
    name: str
@router.post('/containers/{cid}/rename')
async def post_container_rename(cid: str, model: RenameRequestModel, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    container.rename(model.name)
    return {'id': container.id}

@router.post('/containers/{cid}/pause')
async def post_container_pause(cid: str, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    container.pause()
    return {'id': container.id}

@router.post('/containers/{cid}/unpause')
async def post_container_pause(cid: str, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    container.unpause()
    return {'id': container.id}

@router.post('/containers/{cid}/stop')
async def post_container_pause(cid: str, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    container.stop()
    container.remove()
    return {'id': container.id}

@router.post('/containers/{cid}/restart')
async def post_container_pause(cid: str, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    container.restart()
    return {'id': container.id}

class NewContainerRequestModel(BaseModel):
    name: str
    envvars: list
    display_name: str

def load_local_container(name, env, dname):
    context = client()
    if dname == '':
        dname = name
    image, logs = context.images.build(
        path=os.path.join(cfg()['localDockerDirectory'], name),
        tag=f'{dname}-{str(time.time())}',
        labels={'originator': 'Web Panel'}
    )
    cont = context.containers.run(
        image=image.id,
        detach=True,
        restart_policy={"Name": "always"},
        name=dname
    )
@router.post('/containers/new/local')
async def post_new_local_container(model: NewContainerRequestModel, response: Response):
    if os.path.exists(os.path.join(cfg()['localDockerDirectory'], model.name)):
        multiprocessing.Process(target=load_local_container, args=[model.name, model.envvars, model.display_name], daemon=True).start()
        return {}
    else:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Folder @ {model.name} not found.'}

def load_remote_container(_name, env, dname):
    context = client()
    if ':' in _name:
        name = _name.split(':')[0]
        tag = _name.split(':')[1]
    else:
        name = _name+''
        tag = 'latest'
    image = context.images.pull(
        repository=name,
        tag=tag
    )
    if dname == '':
        dname = name
    container = context.containers.run(
        image.id, 
        detach=True, 
        restart_policy={"Name": "always"}, 
        name=name
    )

@router.post('/containers/new/remote')
async def post_new_remote_container(model: NewContainerRequestModel, response: Response):
    try:
        multiprocessing.Process(target=load_remote_container, args=[model.name, model.envvars, model.display_name], daemon=True).start()
        return {}
    except KeyboardInterrupt:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Image {model.name} not found.'}

@router.get('/containers/{cid}/logs')
async def get_container_logs(cid: str, response: Response):
    try:
        container = client().containers.get(cid)
    except docker.errors.NotFound:
        response.status_code = 404
        return {'result': 'failure:not found', 'reason': f'Docker container {cid} does not exist.'}
    return {'logs': container.logs()}