const testnetClient = lisk.APIClient.createTestnetAPIClient();
const { Mnemonic } = lisk.passphrase;
const temporaryPassphrase = Mnemonic.generateMnemonic();
const temporaryAddress = lisk.cryptography.getAddressFromPassphrase(temporaryPassphrase);


/* GENERAL FUNCTIONALITY */

function getUnProccesedTransactions() {
    testnetClient.node.getStatus()
    .then(res => {
        document.getElementById("unProcessedTransactions").innerHTML = "Total unprocessed testnet transactions: " + res.data.transactions.unprocessed
    })
}

checkBalanceInterval = setInterval(getUnProccesedTransactions, 5000);

const uploadExclusions = ["9911837072540857610"];

function getRecentUploads() {
    testnetClient.transactions.get({
        recipientId: '607302630603523015L',
        maxAmount: 1,
        limit: 15,
        sort: "timestamp:desc"
    })
    .then(res => {
        for (let i = 0; i < res.data.length; i++) {
            let uploadId = res.data[i].senderId;
            console.log(uploadId);
            if (uploadExclusions.indexOf(uploadId.slice(0, -1)) >= 0) {  
                console.log("Skipping: " + uploadId)
            } else {
                document.getElementById("latestUploads").innerHTML += uploadId.slice(0, -1) + "<br>"
            }
        }
    })
}

getRecentUploads()


/* UPLOAD FUNCTIONALITY */

function handleFileSelect() {
    const file = document.querySelector('input[type=file]').files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileContent = e.target.result;
        const uint8View = new Uint8Array(fileContent);
        encodeBase91(uint8View);
    }
    reader.readAsArrayBuffer(file);
    document.getElementById("fileInfo").innerHTML = `Input: ${file.name} (${file.size} bytes)`;
    fileExtension = file.name.split('.').pop();
    console.log(fileExtension)

}

function encodeBase91(data) {
    console.log(data);
    const base = base91.encode(data);
    const txData = fileExtension + "❤" + base;
    document.getElementById("encodedSize").innerHTML = "Number of encoded bytes to be sent: " + txData.length;
    console.log(txData)
    splitData(txData);

}

function splitData(txData) {
    var baseObject = txData;
    baseArray = [];
    baseArray.push(baseObject.substring(0, 62));

    for (var i = 62, charsLength = baseObject.length; i < charsLength; i += 64) {
        baseArray.push(baseObject.substring(i, i + 64));
    }

    arrayLength = baseArray.length;
    document.getElementById("requiredTx").innerHTML = "Transactions required: <b>" + arrayLength + "</b>";
    feeAmount = calculateFees(arrayLength)
}

function calculateFees(txAmount) {
    const liskFee = 0.1;
    let beddows = 0;
    let totalFee = 0.00000000;

    for (var i = 0; i <= txAmount; i += 1) {
        beddows += i;
    }

    totalFee += (txAmount * 0.1) + (beddows / 100000000)
    return totalFee;
}

function displayTemporaryAddressData() {
    if (!document.getElementById("fileInfo").innerHTML) {
        alert("No file selected");
    } 
    else if (arrayLength > 900) {
        window.alert("Transactions exceed maximum amount (900)")
    }
    else {
        generateTempDataAndCheckBalance()
    }
}

function displayIdentifier() {
    document.getElementById("uniqueUploadIdentifier").value = temporaryAddress.slice(0, -1);
    document.getElementById("uniqueUploadIdentifier").readOnly = true;
    document.getElementById("message").value = "Share this identifier";

}

function generateTempDataAndCheckBalance() {
    checkBalanceInterval = setInterval(checkBalance, 1000);
    document.getElementById("temporaryUploadData").innerHTML = `<a class="payment" href="lisk://wallet?recipient=${temporaryAddress}&amount=${feeAmount.toFixed(8)}">Send ${feeAmount.toFixed(8)} LSK to ${temporaryAddress}</a>`;
    document.getElementById("paymentStatus").innerHTML = `<div class="loader"></div>`

    let temporaryBalance = 0;

    let i = 1;

    function checkBalance() {
        testnetClient.accounts.get({
            address: temporaryAddress
        })
        .then(res => {
            if (res.data.length > 0) {
                temporaryBalance = res.data[0].balance / 100000000
                document.getElementById("pendingUploadData").innerHTML = `${(feeAmount - temporaryBalance).toFixed(8)} LSK pending`;

                if (temporaryBalance >= feeAmount.toFixed(8)) {
                    document.getElementById("paymentStatus").innerHTML = ``;
                    document.getElementById("temporaryUploadData").innerHTML = ``;
                    document.getElementById("pendingUploadData").innerHTML = `LSK received <b class="marker">✓</b>`;
                    stopLoop()
                }

            } else {
                document.getElementById("pendingUploadData").innerHTML = `${(feeAmount - temporaryBalance).toFixed(8)} LSK pending`;
            }

        })
    }

    function stopLoop() {
        clearInterval(checkBalanceInterval);
        sendTransactions();
    }
}

function sendTransactions() {
    console.log(baseArray);
    console.time("TX broadcasting");
    var beddowsAmount = 1
    for (var i = 0; i < arrayLength; i++) {
        var tx = lisk.transaction.transfer({
            amount: beddowsAmount,
            recipientId: '607302630603523015L',
            data: baseArray[i],
            passphrase: temporaryPassphrase,
        })
        console.log(tx.id)
        console.log(tx.asset.data)
        transactionSucces = 0;
        transactionFailed = 0;

        testnetClient.transactions.broadcast(tx)
        .then(res => {
            console.log(res.data.message)
            console.log("Yay!");
            transactionSucces += 1;
            document.getElementById("txSuccesNumber").innerHTML = "Transactions accepted: " + transactionSucces;
            if (transactionSucces == arrayLength) {
                document.getElementById("txSuccesNumber").innerHTML = `All ${transactionSucces} transactions accepted <b class="marker">✓</b>`
            }

        }).catch(res => {
            console.log("Boo!!");
            transactionFailed += 1;
            document.getElementById("txFailureNumber").innerHTML = "Transactions failed: " + transactionFailed;
        })

        beddowsAmount += 1

    }
    document.getElementById("broadcastStatus").innerHTML = `All transactions pushed to node <b class="marker">✓</b>`
    displayIdentifier()
    console.timeEnd("TX broadcasting");
}


/* DOWNLOAD FUNCTIONALITY */

function getFileData(input) {
    fileData = [];
    userInput = document.getElementById("uniqueDownloadIdentifier").value + "L"

    var beddowAmount = 0
    var transactionCount = 0

    // Initial API call te determine number of transactions
    testnetClient.transactions.get({
        recipientId: '607302630603523015L',
        senderId: userInput,
    })
    .then(res => {
        transactionCount = res.meta.count;
        offsetAmount = 0

        console.log(`Requesting ${transactionCount} transactions …`);

        var done = [];

            // Loop through result pages
            while (offsetAmount < transactionCount) {
                done.push(testnetClient.transactions.get({
                    offset: offsetAmount,
                    limit: 100,
                    recipientId: '607302630603523015L',
                    senderId: userInput
                })
                .then(res => {
                        // Retrieve data from all results on the page
                        for (var i = 0; i < res.data.length; i++) {
                            fullData = res.data[i].asset.data;
                            beddowAmount = res.data[i].amount / 100000000
                            fileData.push([beddowAmount.toFixed(8), fullData]);
                        }
                    }));

                offsetAmount += 100;
            }

            console.log(`Waiting for ${done.length} requests to finish …`);
            Promise.all(done).then(() => {
                console.log(fileData)
                stitchData()
            });
        });
}

function stitchData() {
    fileDataStitched = "";
    console.log(fileDataStitched);
    fileDataSorted = fileData.sort()
    console.log(fileDataSorted.length);


    for (var i = 0; i < fileDataSorted.length; i++) {
        fileDataStitched += fileDataSorted[i][1];

    }

    let fileDataStitchedSplitted = fileDataStitched.split("❤")
    console.log(fileDataStitchedSplitted[1])
    rawData = decodeBase91(fileDataStitchedSplitted[1])

    console.log(rawData)

    function Decodeuint8arr(uint8array) {
        return new TextDecoder("utf-8").decode(uint8array);
    }
    console.log(Decodeuint8arr(rawData))
    var saveByteArray = (function() {
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return function(data, name) {
            var blob = new Blob(data, {
                type: "octet/stream"
            }),
            url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = name;
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }());

    saveByteArray([rawData], "download." + fileDataStitchedSplitted[0]);

}

function decodeBase91(data) {
    console.log(data);
    return base91.decode(data)
}