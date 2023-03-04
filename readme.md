
# CLI OPCUA Client with NodeOPCUA



![alt text](
https://raw.githubusercontent.com/node-opcua/opcua-commander/master/docs/demo.gif "...")

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/opcua-commander)


### install from npm

    $ npm install opcua-commander -g
    $ opcua-commander -e opc.tcp://localhost:26543 
        

### install from source


    $ git clone https://github.com/node-opcua/opcua-commander.git
    $ cd opcua-commander
    $ npm install
    $ npm install -g typescript
    $ npm run build
    $ node dist/index.js -e opc.tcp://localhost:26543 
    
    
### install on ubuntu

if you have EACCES error on linux,

     $ npm install -g opcua-commander --unsafe-perm=true --allow-root
     $ sudo npm install -g opcua-commander --unsafe-perm=true --allow-root


### run with docker

build your docker image

    $ docker build . -t commander
    
Run the docker image

    $ docker run -it commander -e opc.tcp://localhost:26543     
     
