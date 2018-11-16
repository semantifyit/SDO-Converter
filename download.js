let fs = require('fs');
let request = require('request');

//loads the schema.jsonld from Schema.org and saves it in the input directory
async function downloadSchema(PATH_INPUT_DIRECTORY, version) {
    return new Promise(function (resolve, reject) {
        let uri = "http://schema.org/version/" + version + "/schema.jsonld";
        request.get(uri).on('response', function (res) {
            if (res.statusCode === 200) {
                if (!fs.existsSync(PATH_INPUT_DIRECTORY + "/" + version)) {
                    fs.mkdirSync(PATH_INPUT_DIRECTORY + "/" + version);
                }
                let file = fs.createWriteStream(PATH_INPUT_DIRECTORY + "/" + version + "/schema.jsonld");
                res.pipe(file);
                console.log("Downloaded: " + PATH_INPUT_DIRECTORY + "/" + version + "/schema.jsonld");
                file.on('finish',resolve);
            } else {
                console.log("No file could be retrieved from Schema.org for your specified version: " + version);
                reject();
            }
        })
    });
}

module.exports = downloadSchema;