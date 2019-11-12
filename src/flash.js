const temp = require('temp');
const path = require('path');
const selector = require('./modules/selector');
const https = require('follow-redirects').https;
const fs = require('fs');
const {dialog} = require('electron').remote;

temp.track();

/**
 * Download keymap from API before initiating programmer selection
 * @param {string} url URL from compiler API for file download
 * @param {string} keyboard Name of keyboard
 * @param {string} filename Name of file to save download to
 * @module window.Bridge
 */
function flashURL(url, keyboard, filename) {
  console.log(url, keyboard, filename);
  temp.mkdir('qmkconfigurator', function(err, dirPath) {
    window.tempFolder = dirPath;
    window.Bridge.statusAppend('----STARTING URL FLASHING PROCEDURES----');
    window.inputPath = path.join(dirPath, filename);
    console.log(window.inputPath);
    pipeFile = fs.createWriteStream(window.inputPath);
    https
      .get(url, function(response) {
        response.pipe(pipeFile);
        pipeFile.on('finish', function() {
          console.log('finish downloads');
          selector.routes(keyboard);
          pipeFile.close();
        });
      })
      .on('error', function(err) {
        // Handle errors
        fs.unlink(imputPath); // Delete the file async. (But we don't check the result)
      });
  });
}

/**
 * Flash a custom file
 */
function flashFile() {
  window.Bridge.statusAppend('----STARTING FILE FLASHING PROCEDURES----');
  dialog
    .showOpenDialog(process.win, {
      filters: [{name: '.bin, .hex', extensions: ['bin', 'hex']}],
      properties: ['openFile'],
    })
    .then(({canceled, filePaths, bookmarks}) => {
      if (canceled) {
        window.Bridge.statusAppend('Flash Cancelled');
        return;
      }
      if (filePaths.length === 1) {
        console.log(filePaths);
        window.inputPath = filePaths[0];
        selector.routes();
      }
    });
}

module.exports = {
  flashURL,
  flashFile,
};
