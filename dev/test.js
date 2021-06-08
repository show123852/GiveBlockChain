const Blockchain = require('./blockchain');
const bitcoin = new Blockchain();


const bc1 = {
    "chain": [
    {
    "index": 1,
    "timestamp": 1620576312844,
    "transactions": [],
    "nonce": 100,
    "hash": "0",
    "previousBlockHash": "0"
    },
    {
    "index": 2,
    "timestamp": 1620576346420,
    "transactions": [],
    "nonce": 18140,
    "hash": "0000b9135b054d1131392c9eb9d03b0111d4b516824a03c35639e12858912100",
    "previousBlockHash": "0"
    },
    {
    "index": 3,
    "timestamp": 1620576489303,
    "transactions": [
    {
    "amount": 12.5,
    "sender": "00",
    "recipient": "5616f4c0b0e011ebb9ee756460289717",
    "transactionId": "6a2a92f0b0e011ebb9ee756460289717"
    },
    {
    "amount": 10,
    "sender": "fsfasdf",
    "recipient": "asdfasfdsf",
    "transactionId": "a7dc5610b0e011ebb9ee756460289717"
    },
    {
    "amount": 20,
    "sender": "fsfasdf",
    "recipient": "asdfasfdsf",
    "transactionId": "ad0941c0b0e011ebb9ee756460289717"
    },
    {
    "amount": 30,
    "sender": "fsfasdf",
    "recipient": "asdfasfdsf",
    "transactionId": "aee15d20b0e011ebb9ee756460289717"
    }
    ],
    "nonce": 108989,
    "hash": "0000770044ad6102d55e028d5e6fc6cc85f227f19da06437f7642db4e80e170a",
    "previousBlockHash": "0000b9135b054d1131392c9eb9d03b0111d4b516824a03c35639e12858912100"
    },
    {
    "index": 4,
    "timestamp": 1620576533583,
    "transactions": [
    {
    "amount": 12.5,
    "sender": "00",
    "recipient": "5616f4c0b0e011ebb9ee756460289717",
    "transactionId": "bf44eba0b0e011ebb9ee756460289717"
    }
    ],
    "nonce": 146096,
    "hash": "0000d41eef99efe3e9934d2c2903b1026587b8a1192815532659c0ca8e32a5ba",
    "previousBlockHash": "0000770044ad6102d55e028d5e6fc6cc85f227f19da06437f7642db4e80e170a"
    }
    ],
    "pendingTransactions": [
    {
    "amount": 12.5,
    "sender": "00",
    "recipient": "5616f4c0b0e011ebb9ee756460289717",
    "transactionId": "d9a95c10b0e011ebb9ee756460289717"
    }
    ],
    "currentNodeUrl": "http://localhost:3001",
    "networkNodes": []
    }




console.log('VALID: ', bitcoin.chainIsValid(bc1.chain));









