const request = require("request");
const fs = require("fs");
const client = require("https");
var status = [];
var express = require('express');
var app = express();
const archiver = require('archiver');


function zipDirectory(source, out) {
    const archive = archiver('zip', {
        zlib: {
            level: 9
        }
    });
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
        archive
            .directory(source, false)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
}

if (!fs.existsSync("./Downloaded")) {
    fs.mkdirSync("./Downloaded");
}

app.get('/', function(req, res) {
    res.sendFile(__dirname + "/index.html");
});

app.get('/css/:file', function(req, res) {
    res.sendFile(__dirname + "/css/" + req.params.file);
});

app.get('/css/bootstrap/:file', function(req, res) {
    res.sendFile(__dirname + "/css/bootstrap/" + req.params.file);
});

app.get('/scss/:file', function(req, res) {
    res.sendFile(__dirname + "/scss/" + req.params.file);
});

app.get('/scss/bootstrap/:file', function(req, res) {
    res.sendFile(__dirname + "/scss/bootstrap/" + req.params.file);
});

app.get('/js/:file', function(req, res) {
    res.sendFile(__dirname + "/js/" + req.params.file);
});

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        client.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else {
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
            }
        });
    });
}

function get(path) {
    return new Promise(function(resolve, reject) {
        request({
            url: "https://manga.bilibili.com/twirp/comic.v1.Comic/ImageToken?device=pc&platform=web",
            method: "POST",
            json: {
                urls: "[\"" + path + "\"]"
            }
        }, function(err, res, data) {
            if (err || res.statusCode != 200) reject("Có lỗi máy chủ. Vui lòng thử lại.");
            resolve(data.data[0].url + "?token=" + data.data[0].token);
        });
    });
}

app.get("/Status/:id", function(req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Content-Type", "application/json");
    res.send({
        success: true,
        status: status[req.params.id] ? status[req.params.id] : ""
    });
});

app.get("/DownloadFile/:id", function(req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    if (fs.existsSync(__dirname + "/Downloaded/" + req.params.id + ".zip")) {
        res.header("Content-Type", "application/zip");
        res.sendFile(__dirname + "/Downloaded/" + req.params.id + ".zip");
    } else {
        res.header("Content-Type", "application/json");
        res.status(404).send({
            success: false,
            error_code: 404,
            message: "File not found."
        });
    }
});

app.get("/Download/:id", function(req, resp) {
    resp.header("Access-Control-Allow-Origin", "*");
    resp.header("Content-Type", "application/json");
    var id = req.params.id,
        json = {};
    if (!fs.existsSync(__dirname + "/Downloaded/" + id + ".zip")) {
        if (status[id]) return resp.status(400).send({
            success: false,
            error_code: 400,
            message: "This comic chapter is currently being downloaded by another user. Please wait for a few minutes."
        });
        status[id] = "Getting chapter information...";
        request({
            url: "https://manga.bilibili.com/twirp/comic.v1.Comic/GetImageIndex?device=pc&platform=web",
            method: "POST",
            json: {
                ep_id: id
            }
        }, async function(err, res, data) {
            try {
                if (err || res.statusCode != 200) {
                    json.success = false;
                    json.error_code = 500;
                    json.message = "Cannot connect to Bilibili server.";
                }
                var images = data.data.images;
                status[id] = "Parsing chapter images...";
                for (var i = 0; i < images.length; i++) {
                    status[id] = "Downloading image " + (i + 1) + " of " + images.length + "...";
                    var path = images[i].path;
                    var u = await get(path);
                    if (!fs.existsSync("./Downloaded" + id)) {
                        fs.mkdirSync("./Downloaded/" + id, {
                            recursive: true
                        });
                    }
                    await downloadImage(u, "./Downloaded/" + id + "/" + (i + 1) + ".jpg");
                }
                status[id] = "Compressing...";
                await zipDirectory("./Downloaded/" + id, "./Downloaded/" + id + ".zip");
                fs.rmSync(__dirname + "/Downloaded/" + id, {
                    recursive: true
                });
                json.success = true;
                json.message = "Operated successfully";
                json.path = "/DownloadFile/" + id;
                setInterval(function() {
                    fs.rmSync(__dirname + "/Downloaded/" + id + ".zip");
                }, 3600000);
                status[id] = undefined;
                if (json.success) resp.send(json);
                else resp.status(json.error_code).send(json);
            } catch (err) {
                resp.status(500).send({
                    success: false,
                    error_code: 500,
                    error_info: JSON.stringify(err)
                });
            }
        });
    } else {
        json.success = true;
        json.message = "This file already exists in the server.";
        json.path = "/DownloadFile/" + id;
        resp.send(json);
    }
});

var server = app.listen(process.env.PORT ? process.env.PORT : 3000, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Server has successfully started on %s:%s", host, port);
});