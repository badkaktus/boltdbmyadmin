# boltdbmyadmin
A simple SPA BoltDB GUI Admin panel with docker, JSON highlight syntax and unlimited boltdb database files. Based on [boltdbweb](github.com/evnix/boltdbweb). 

UI framework - [AntDesign](https://github.com/ant-design/ant-design/).

JSON highlight syntax - [JSON tree viewer](https://www.npmjs.com/package/react-json-tree)

##### Usage
```
docker run -p 8080:8080 -v [absolute path to directory with *.db files]:/app/boltdbs -d kolyuchy/boltdbmyadmin
```
- `absolute path to directory with *.db files` - directory can be include subdirectory. All *.db files copied to `/app` 
in container will be loaded to UI

##### docker-compose example
```
services:
  web:
    build: kolyuchy/boltdbmyadmin:latest
    ports:
      - "8080:8080"
    volumes:
      - .:/app
```

##### Screenshots:

![](https://github.com/kolyuchy/boltdbmyadmin/blob/master/screenshots/1.png?raw=true)

![](https://github.com/kolyuchy/boltdbmyadmin/blob/master/screenshots/2.png?raw=true)