let readline = require('readline');
let Spinner = require('cli-spinner').Spinner;
let axios = require('axios');
let cheerio = require('cheerio');
let fs = require('fs');
const URL = require('url').URL;

// NOTE: terminal log colors
let Reset = "\x1b[0m"
let Underscore = "\x1b[4m"
let FgRed = "\x1b[31m"
let FgGreen = "\x1b[32m"
let FgCyan = "\x1b[36m"

// NOTE: used for parsing each line of file to array
// NOTE: there are tow files, source sentence in one languge and another one in other language
let source = []
let target = []

// NOTE: prepare variables
let sourceFile = new URL('file:////home/gogi/School/jezikovne/project/parser/translations/Batch3a_sl.txt');
let targetFile = new URL('file:////home/gogi/School/jezikovne/project/parser/translations/Batch3a_en.txt');

// NOTE: on of this parameters is the only one possible
// USED FOR: if you want to list translations you can take a look at succeeded,
// USED FOR: failed or both.
let possibleArguments = ['succeeded', 'failed', 'both']

// NOTE: in order to let server breathe we setup interval for requests
let runningInterval = 100 // NOTE: in ms

// NOTE: link to backend
let link = 'http://localhost:3333'

//start - Checking parameters
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
//end - Checking parameters


// NOTE: used for calculating amount of time used for translations and calculations
let startTime = +new Date()

// NOTE: reader for source
let lineReaderSource = readline.createInterface({
  input: fs.createReadStream(sourceFile)
});

// NOTE: reader for target
let lineReaderTarget = readline.createInterface({
  input: fs.createReadStream(targetFile)
});

//push each line from target to target array
lineReaderTarget.on('line', function (line) {
  target.push(line)
})

//push each line from source to source array
lineReaderSource.on('line', function (line) {
  source.push(line)
})

// NOTE: when file reading is finished ping api with each line
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

// NOTE: used for logging info
let amountOfAlredyFinishedItems = 0

//start - pinging api with post requests
Promise.all([promise1, promise2]).then((res) => {
  console.log("_____________________________");
  console.log();

  // NOTE: checking test files are same length
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

  // NOTE: used spinner for live interaction with user
  let spinner = new Spinner('%s Translating sentence 0 of ' + source.length);
  spinner.setSpinnerString('|/-\\');
  spinner.start();

  // NOTE: promises var is used as each request to backend
  let promises = []
  for (let i = 0; i < source.length; i++) {
    // if(i==10) {
    //   break;
    // }
    let p = new Promise((resolve, reject) => {
      let position = i;

      // NOTE :setting timeout for wach call at interval*index
      setTimeout(() => {
        axios({
          method: 'POST',
          url: link,
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

            // NOTE: get text from neural monkey translated response
            let translated = $('.translation p').text()
            amountOfAlredyFinishedItems += 1

            var translatedLine = {
              position: position,
              source: source[position],
              target: target[position],
              translated: translated
            }

            if(translated != target[i]) {
              translatedLine.success = false
            }else {
              translatedLine.success = false

            }
            //updating spinner
            spinner.setSpinnerTitle('Translating sentence ' + amountOfAlredyFinishedItems + ' of ' + source.length);

            resolve(translatedLine)
          }

        }).catch(function (error) {
          amountOfAlredyFinishedItems += 1
          //updating spinner
          spinner.setSpinnerTitle('Translating sentence ' + amountOfAlredyFinishedItems + ' of ' + source.length);

          // iterate(spinner)

          resolve({
            success: false,
            position: position,
            source: source[position],
            target: target[position],
            translated: '',
            err: error
          })

        });
      }, runningInterval*position)

    })
    promises.push(p)

  }

  // NOTE: after getting all translation stop spinner and calculate %s
  Promise.all(promises).then((data) => {
    //call it after 200ms in order to update spinner to last/max line number
    setTimeout(stopSpinner, 200, spinner, data)
  })

})

//end - pinging api with post requests


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

  // NOTE: in case user DOESN'T want to iterate over transitions
  if(toLog.length == 0) {
    process.exit(1)
  }

  // NOTE: async iteration
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
