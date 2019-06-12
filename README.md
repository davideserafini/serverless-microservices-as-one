# Serverless Microservices As One
This is a node server that allows to use multiple running serverless offline instances as a single backend

When using the microservices architecture with serverless framework and the serverless offline plugin, you can't have more than one microservice running locally on the same host and port.
As a frontend developer, this can be troublesome when using serverless offline as a local backend for the frontend, where it's not reasonable to have different urls for each microservice.
As a backend developer, yes it's true you can start the microservice you are working on, but how many times you need to check a different endpoint in another microservice, or your colleague ask you to quickly check something that it's not working? More than we'd like to admit, and having to stop and start the server every time is a nono for me.

That's why I've created this node server that acts as a proxy.

## How it works
This is basically what it does:
* starts serverless offline for every microservice found in the /functions directory
* proxies and routes every incoming request to the correct server matching method and endpoint of the request
* show all console output of every service in its console

## How to use
* run `node index.js --servicesFolderPath path/to/services`
### Command line options
```
--servicesFolderPath path to folder containing services
--appPort            port to listen to, default 3001
--port               port to start sls offline from
--stage              stage for sls offline
```

## Please note
* I've created this in less than 3 hours, so it's not so well written (but at least it's commented!)
* It's my first project with node and express 😅

I'd like to make this more ready for a general use so in the next days I will add for sure support for passing arguments at startup and solve the TODOs left in the code.

Check the issue tab to see what's planned in details

Any comment, idea or test is appreciated :)
