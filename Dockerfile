FROM node:alpine3.10


RUN apk add openssl dos2unix

# Create app directory
WORKDIR /opt/opcuacommander

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
# Bundle app source
COPY . .
COPY package*.json ./
COPY create_certificate.js ./
RUN dos2unix bin/opcua-commander 
#RUN apt-get update && apt-get install -y dos2unix                        \
#    && dos2unix bin/opcua-commander                                      \
#    && apt-get --purge remove -y dos2unix && rm -rf /var/lib/apt/lists/*

# RUN npm install -g opcua-commander --unsafe-perm=true --allow-root
# RUN npm install --unsafe-perm=true --allow-root
# If you are building your code for production
RUN npm ci --only=production --unsafe-perm=true --allow-root


CMD [ "/bin/bash bin/opcua-commander" ]


# to build
#    docker build . -t commander

# to run 
#    docker run -it commander bin/opcua-commander -e opc.tcp://localhost:26543
