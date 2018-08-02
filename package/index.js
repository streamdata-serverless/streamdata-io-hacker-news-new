exports.handler = (event, context, callback) => {

    // Streamdata Dependencies
    var streamdataio = require('streamdataio-js-sdk/dist/bundles/streamdataio-node');
    var AuthStrategy = require('streamdataio-js-sdk-auth');

    // All The Other Dependencies
    var axios = require('axios');
    var jsonPatch = require('fast-json-patch');
    var print = require('node-print');
    var AWS = require('aws-sdk');

    // Function for writing to S3
    function putObjectToS3(s3bucket, s3key, data){
    var s3 = new AWS.S3();
        var params = {
            Bucket : s3bucket,
            Key : s3key,
            Body : data
        }
        s3.putObject(params, function(err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else     console.log(data);           // successful response
        });
        }

    function server()
    {
      // targetUrl is the JSON API you wish to stream
      var targetUrl = process.env.targetUrl;

      // s3bucket i sthe bucket you wish write data into
      var s3bucket = process.env.s3bucket;

      // targetFolder is the folder you wish to write data into
      var targetFolder = process.env.targetFolder;

      // appToken is the Streamdata.io token
      var appToken = process.env.appToken;

      // userAgent is used to identify your client
      var userAgent = process.env.userAgent;

      var privateKey = '';

      var headers = ['User-Agent: ' + userAgent];

      var eventSource = streamdataio.createEventSource(targetUrl, appToken, headers, AuthStrategy.newSignatureStrategy(appToken, privateKey));
      var result = [];

      eventSource
      // the standard 'open' callback will be called when connection is established with the server
        .onOpen(function ()
        {
          console.log("connected!");
        })
        // the streamdata.io specific 'data' event will be called when a fresh Json data set
        // is pushed by Streamdata.io coming from the API
        .onData(function (data)
        {
          console.log("data received");
          // memorize the fresh data set

          result = data;

          // Loop through each id (not the ideal API design, but dealing with it)
          result.forEach(function(id) {

            // build a url to pull each individual entry
            var url = 'https://hacker-news.firebaseio.com/v0/item/' + id + '.json?print=pretty';

            // make separate API call to get detail
            axios.get(url)
              .then(response => {

                // write individual entry with id as file name
                var file = targetFolder + '/' + id + '.json';           
                putObjectToS3(s3bucket, file, JSON.stringify(response.data));
             
              })
              .catch(error => {
                console.log(error);
              });

          });


        })
        // the streamdata.io specific 'patch' event will be called when a fresh Json patch
        // is pushed by streamdata.io from the API. This patch has to be applied to the
        // latest data set provided.
        .onPatch(function (patch)
        {

          // apply the patch to data using json patch API
          jsonPatch.applyPatch(result, patch);

          // Loop through each id (not the ideal API design, but dealing with it)
          result.forEach(function(id) {

            // build a url to pull each individual entry
            var url = 'https://hacker-news.firebaseio.com/v0/item/' + id + '.json?print=pretty';

            // make separate API call to get detail
            axios.get(url)
              .then(response => {

                // write individual entry with id as file name
                var file = targetFolder + '/' + id + '.json';           
                putObjectToS3(s3bucket, file, JSON.stringify(response.data));
             
              })
              .catch(error => {
                console.log(error);
              });

          });

        })

        // the standard 'error' callback will be called when an error occur with the evenSource
        // for example with an invalid token provided
        .onError(function (error)
        {
          console.log('ERROR!', error);
          eventSource.close();

        });

      eventSource.open();

    }

    console.log('starting');
    server();
};
