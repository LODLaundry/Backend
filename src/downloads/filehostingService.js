var util = require('util'),
  http = require('http'),
  fs = require('fs'),
  url = require('url'),
  path = require('path'),
  utils = require('../utils.js'),
  config = require('../../config.js');


if (!process.env['CRAWL_DIR']) throw new Error('No CRAWL_DIR variable defined');
if (!fs.existsSync(process.env['CRAWL_DIR'])) throw new Error('Data directory not found: ' + process.env['CRAWL_DIR']);
if (!config.fileHosting.port) throw new Error('No port defined to run  file hosting server on');


if (!process.env['LOG_DIR']) throw new Error("No LOG_DIR variable specified");
if (!fs.existsSync(process.env['LOG_DIR'])) throw new Error("Logging dir (" + process.env['LOG_DIR'] + ") does not exist");




/**
 * Run file hosting server
 */
http.createServer(function(req, res) {
  var setResHeader = function(file) {
    res.setHeader('Content-disposition', 'attachment; filename=' + pathname + file.slice(-6));
    res.setHeader('Content-Type', "application/x-gzip");
    res.writeHead(200);
  }
  var sendDatasetFile = function(file) {
    var stream = fs.createReadStream(file);
    stream.on('error', function(error) {
      utils.sendReponse(res, 500, 'Unable to send gzip file');
    });
    setResHeader(file);
    //I know last 6 chars are extension (either nt.gz or nq.gz). Just use this knowledge (won't change)
    stream.pipe(res);
    utils.logline('downloads.log', [req.headers["user-agent"], pathname]);
  };
  var sendDumpFile = function(file, filename) {
    var contentType = "application/x-gzip";
    var stream = fs.createReadStream(file);
    stream.on('error', function(error) {
      utils.sendReponse(res, 500, 'Unable to send gzip file');

    });
    res.setHeader('Content-disposition', 'attachment; filename=' + filename);
    res.setHeader('Content-Type', contentType);
    res.writeHead(200);
    stream.pipe(res);
    utils.logline('downloads.log', [req.headers["user-agent"], filename]);
  };
  var getDumpFile = function(path, callback) {
    if (path.indexOf(config.datadumps.extension, path.length - config.datadumps.extension.length) != -1) {
      var base = path.substring(0, path.length - config.datadumps.extension.length);
      if (base == config.datadumps.totalFile || base in config.datadumps.graphs) {
        var fileLocation = process.env['DATA_DUMP_DIR'] + "/" + path;
        fs.stat(fileLocation, function(err, stat) {
          if (err) {
            callback(false); //file probably does not exist
          } else {
            var downloadFilename = stat.mtime.getFullYear() + "-" + (stat.mtime.getMonth() + 1) + "-" + stat.mtime.getDate() + "_" + path;
            callback(fileLocation, downloadFilename);
          }
        });


      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  };
  var parsedUrl = url.parse(req.url, true);
  var pathname = path.basename(parsedUrl.pathname);
  var extension = ".nt.gz";
  if (parsedUrl.query && parsedUrl.query.type) {
    if (parsedUrl.query.type == "hdt") {
      extension = ".hdt";
    }
  }
  if (pathname.length == 0) {
    utils.sendReponse(res, 406, 'No dataset defined in download request. To download a file, use the SPARQL endpoint or web interface to get the hash ID, and download the file using http://download.lodlaundromat.org/<md5>');
  } else {
    var dumpFile = getDumpFile(pathname, function(fileLocation, downloadName) {
      if (fileLocation) {
        sendDumpFile(fileLocation, downloadName);
      } else {
        var datasetDir = process.env['CRAWL_DIR'] + '/' + pathname;
        fs.exists(datasetDir, function(datasetDirExists) {
          if (!datasetDirExists) {
            utils.sendReponse(res, 404, 'Dataset not found');
          }
          //ok, dataset directory exists. Does it have a clean file though...
          var cleanFile = datasetDir + '/clean' + extension;
          fs.exists(cleanFile, function(cleanFileExists) {
            if (!cleanFileExists) {
              if (extension == ".nt.gz") {
                //ah, no nt file! Check for an nq file..
                var nqFile = datasetDir + '/clean.nq.gz';
                fs.exists(nqFile, function(nqFileExists) {
                  if (!nqFileExists) {
                    //no nq file AND no nt file..
                    utils.sendReponse(res, 404, 'No cleaned file found for this dataset.');
                  } else {
                    sendDatasetFile(nqFile);
                  }
                });
              } else {
                utils.sendReponse(res, 404, 'No cleaned file found for this dataset.');
              }
            } else {
              if (req.method == "HEAD") {
                setResHeader(cleanFile);
                return res.end();
              }
              sendDatasetFile(cleanFile);
            }

          });

        });
      }
    });
  }
}).listen(config.fileHosting.port);
util.puts('> File hosting backend running on ' + config.fileHosting.port);
