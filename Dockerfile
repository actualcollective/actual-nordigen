FROM node:18-alpine3.14

COPY      . /var/www
WORKDIR   /var/www

RUN yarn install

CMD yarn start
