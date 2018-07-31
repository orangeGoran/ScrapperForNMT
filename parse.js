let readline = require('readline');
let Spinner = require('cli-spinner').Spinner;
let axios = require('axios');
let cheerio = require('cheerio');
let fs = require('fs');
const URL = require('url').URL;

let Reset = "\x1b[0m"
let Underscore = "\x1b[4m"
let FgRed = "\x1b[31m"
let FgGreen = "\x1b[32m"
let FgCyan = "\x1b[36m"

let source = []
let target = []

let sourceFile = new URL('file:////home/gogi/School/jezikovne/project/parser/translations/Batch3a_sl.txt');
let targetFile = new URL('file:////home/gogi/School/jezikovne/project/parser/translations/Batch3a_en.txt');
let possibleArguments = ['succeeded', 'failed', 'both']
let runningInterval = 100 // NOTE: in ms
let link = 'http://localhost:3333'
// let link = 'http://localhost:5000'

var logSucceded = false
var logFailed = false
if(process.argv.length == 3) {
  if(possibleArguments.indexOf(process.argv[2]) != -1) {
    if(process.argv[2] == 'both') {
      logSucceded = true
      logFailed = true
    }else if(process.argv[2] == 'succeeded') {
      logSucceded = true
    }else if(process.argv[2] == 'failed') {
      logFailed = true
    }
  }
}


let startTime = +new Date()

let lineReaderSource = readline.createInterface({
  input: fs.createReadStream(sourceFile)
});

let lineReaderTarget = readline.createInterface({
  input: fs.createReadStream(targetFile)
});

lineReaderTarget.on('line', function (line) {
  target.push(line)
})

lineReaderSource.on('line', function (line) {
  source.push(line)
})

let promise1 = new Promise((resolve, reject) => {
  lineReaderSource.on('close', (res) => {
    console.log("Reading source file:", FgGreen, 'Success', Reset);
    resolve(res)
  })
})

let promise2 = new Promise((resolve, reject) => {
  lineReaderTarget.on('close', (res) => {
    console.log("Reading target file:", FgGreen, 'Success', Reset);

    resolve(res)
  })
})

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


let amountOfAlredyFinishedItems = 0
Promise.all([promise1, promise2]).then((res) => {
  console.log("_____________________________");
  console.log();

  if(source.length != target.length) {
    console.log('Testing source and target length:', FgRed, 'FAIL', Reset);
    console.log('Error message:', FgRed, "The length of source and target are not equal. Plese check files:");
    console.log(Reset, Underscore, sourceFile.href);
    console.log(Reset, Underscore, targetFile.href);
    console.log(Reset);
    return;
  }else {
    console.log('Testing source and target length:', FgGreen, 'Success', Reset);
  }

  let spinner = new Spinner('%s Translating sentence 0 of ' + source.length);
  spinner.setSpinnerString('|/-\\');
  spinner.start();

  let promises = []
  for (let i = 0; i < source.length; i++) {
    // if(i==10) {
    //   break;
    // }
    let p = new Promise((resolve, reject) => {
      let position = i;

      setTimeout(() => {
        axios({
          method: 'POST',
          url: link,//'https://jsonplaceholder.typicode.com/posts',//'http://localhost:5000',
          withCredentials: true,
          data: {
            "source": source[position]
          },
          headers: {
            "Content-type": "application/json; charset=UTF-8"
          }
        }).then(function (response) {
          if(response.status == 200) {
            const $ = cheerio.load(response.data)
            let translated = $('.translation p').text()
            amountOfAlredyFinishedItems += 1

            if(translated != target[i]) {
              resolve({success: false, position: position, source: source[position], target: target[position], translated: translated})
            }else {
              resolve({success: true, position: position, source: source[position], target: target[position], translated: translated})
            }
          }
          // console.log(position);
          spinner.setSpinnerTitle('Translating sentence ' + amountOfAlredyFinishedItems + ' of ' + source.length);

        }).catch(function (error) {
          amountOfAlredyFinishedItems += 1
          spinner.setSpinnerTitle('Translating sentence ' + amountOfAlredyFinishedItems + ' of ' + source.length);

          // iterate(spinner)

          resolve({success: false, position: position, source: source[position], target: target[position], translated: '', err: error})

        });
      }, runningInterval*position)

    })
    promises.push(p)

  }

  Promise.all(promises).then((data) => {
    setTimeout(stopSpinner, 200, spinner, data)
  })

})


function stopSpinner(spinner, data) {
  spinner.stop()
  console.log('');
  console.log("Getting translations:", FgGreen, 'Success', Reset);

  let succeeded = 0
  let failed = 0
  console.log('Analising translations ...');
  var toLog = []
  for (let i = 0; i < data.length; i++) {
    if(data[i].success) {
      if(logSucceded) toLog.push(data[i])
      succeeded++;
    }else {
      if(logFailed) toLog.push(data[i])
      failed++;
    }

  }

  console.log('_____________________________');
  console.log("");
  console.log('Total translations in each file:', FgCyan, source.length, Reset);
  // console.log('Total translations in each file:', FgCyan, 50, Reset);
  console.log('Amount of success translations:\t', FgCyan, succeeded, Reset);
  console.log('Amount of failed translations:\t', FgCyan, failed, Reset);
  console.log('Time spent from starting code:\t', FgCyan, (+new Date() - startTime)/1000, 'sekund', Reset);
  console.log('Success rate:\t\t\t', FgCyan, (succeeded/(succeeded+failed)*100) + "%", Reset);
  console.log('_____________________________');

  if(toLog.length == 0) {
    process.exit(1)
  }


  var index = 0
  var iterateOverChangedDocs = (arr, index) => {
    handleIteratedPromise(arr[index],() => {
      index++;
      if(index < arr.length) {
        iterateOverChangedDocs(arr, index)
      } else {
        process.exit(1)
        return;
      }
    })
  }
  iterateOverChangedDocs(toLog, 0)

}

function waitForUserInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    resolve()
  }))
}

async function handleIteratedPromise(data, callback) {
  console.log("You provided us a parameter for logging items. Please type any key to procceed. In order to exit type 'Ctrl+c'.");

  const ans = await waitForUserInput("").then(() => {

    if(data.success) {
      console.log('Success:', FgGreen, 'true', Reset);
    }else {
      console.log('Success:', FgRed, 'false', Reset);
    }

    console.log(FgCyan, 'Given source:', Reset, data.source, Reset);
    console.log(FgCyan, 'Expected output:', Reset, data.target, Reset);
    console.log(FgCyan, 'Translated sentence:', Reset, data.translated, Reset);
    console.log(FgCyan, 'ERR:', Reset, data.err, Reset);

    callback()
  }).catch(() => {
    callback()
  })
}
