FROM  node:alpine

WORKDIR /server

COPY ./package.json .

RUN npm install

COPY . .

CMD [ "node", "index.js" ]