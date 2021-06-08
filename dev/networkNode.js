const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');
const port = process.argv[2];
const rp = require('request-promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bodyparser = require('body-parser');
const mysql = require('mysql');
const sha256 = require('sha256');

const nodeAddress = uuid().split('-').join('');

const bitcoin = new Blockchain();



const options = {
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : '1234',
    database :'webmarketsrcdb'
};

const sessionStore = new MySQLStore(options);

const connection = mysql.createConnection({
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : '1234',
    database :'webmarketsrcDB'
});

connection.connect();


app.use(session({
    secret : "ghfdhdhdfghdfghfgdh24234",
    resave : false,
    saveUninitialized : true,
    store : sessionStore
}));


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// get entire blockchain
app.get('/blockchain', function (req, res) {
  res.send(bitcoin);
});


// create a new transaction
app.post('/transaction', function(req, res) {
	const newTransaction = req.body;
	const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
	res.json({ note: `Transaction will be added in block ${blockIndex}.` });
});


// broadcast transaction
app.post('/transaction/broadcast', function(req, res) {
	const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
	bitcoin.addTransactionToPendingTransactions(newTransaction);

	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: newTransaction,
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		res.json({ note: 'Transaction created and broadcast successfully.' });
	});
});

// mine a block
app.get('/mine', function(req, res) {
	const lastBlock = bitcoin.getLastBlock();
	const previousBlockHash = lastBlock['hash'];
	const currentBlockData = {
		transactions: bitcoin.pendingTransactions,
		index: lastBlock['index'] + 1
	};
	const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
	const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);
	const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: { newBlock: newBlock },
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		const requestOptions = {
			uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
			method: 'POST',
			body: {
				amount: 12.5,
				sender: "00",
				recipient: nodeAddress
			},
			json: true
		};

		return rp(requestOptions);
	})
	.then(data => {
		res.json({
			note: "New block mined & broadcast successfully",
			block: newBlock
		});
	});
});


// receive new block
app.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = bitcoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	if (correctHash && correctIndex) {
		bitcoin.chain.push(newBlock);
		bitcoin.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		});
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		});
	}
});


app.get('/b', function(req, res) {
	res.sendFile('./block-explorer/b.html', { root: __dirname });
});


// register a node and broadcast it the network
app.get('/register-and-broadcast-node', function(req, res) {
	const newNodeUrl = "http://localhost:3000";
	if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) bitcoin.networkNodes.push(newNodeUrl);

	const regNodesPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/register-node',
			method: 'POST',
			body: { newNodeUrl: newNodeUrl },
			json: true
		};

		regNodesPromises.push(rp(requestOptions));
	});

	Promise.all(regNodesPromises)
	.then(data => {
		const bulkRegisterOptions = {
			uri: newNodeUrl + '/register-nodes-bulk',
			method: 'POST',
			body: { allNetworkNodes: [ ...bitcoin.networkNodes, bitcoin.currentNodeUrl ] },
			json: true
		};

		return rp(bulkRegisterOptions);
	})
    .then(data => {
        const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		const currentChainLength = bitcoin.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;

		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
			};
		});


		if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not been replaced.',
				chain: bitcoin.chain
			});
		}
		else {
			bitcoin.chain = newLongestChain;
			bitcoin.pendingTransactions = newPendingTransactions;
			// res.json({
			// 	note: 'This chain has been replaced.',
			// 	chain: bitcoin.chain
			// });
		}
        //
	});
    })
	.then(data => {
        res.send('<script>alert("블록체인에 접속되었습니다");location.href="/";</script>');
	});
});


// register a node with the network
app.post('/register-node', function(req, res) {
	const newNodeUrl = req.body.newNodeUrl;
	const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
	const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);
	res.json({ note: 'New node registered successfully.' });
});


// register multiple nodes at once
app.post('/register-nodes-bulk', function(req, res) {
	const allNetworkNodes = req.body.allNetworkNodes;
	allNetworkNodes.forEach(networkNodeUrl => {
		const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl);
	});

	res.json({ note: 'Bulk registration successful.' });
});


// consensus
app.get('/consensus', function(req, res) {
	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		const currentChainLength = bitcoin.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;

		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
			};
		});


		if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not been replaced.',
				chain: bitcoin.chain
			});
		}
		else {
			bitcoin.chain = newLongestChain;
			bitcoin.pendingTransactions = newPendingTransactions;
			// res.json({
			// 	note: 'This chain has been replaced.',
			// 	chain: bitcoin.chain
			// });
            res.redirect('/');
		}

        //
	});
});


// get block by blockHash
app.get('/block/:blockHash', function(req, res) { 
	const blockHash = req.params.blockHash;
	const correctBlock = bitcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});


// get transaction by transactionId
app.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const trasactionData = bitcoin.getTransaction(transactionId);
	res.json({
		transaction: trasactionData.transaction,
		block: trasactionData.block
	});
});


// get address by address
app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = bitcoin.getAddressData(address);
	res.json({
		addressData: addressData
	});
});


app.get('/block-explorer',function(req,res){
    res.render("blockexplorer.ejs",{session:req.session.Display});
})


/////////////////////////////////////////////////////////////////////


//홈페이지
app.get('/', function(req, res){
    if(req.session.Display){
        res.render('welcome.ejs',{'session':req.session.Display});
    }else{
        res.render('welcome.ejs',{'session':""});
    }
});

//로그아웃(세션삭제)
app.get('/logout',function(req,res){
    delete req.session.Display;
    req.session.save(function(){
        res.redirect('/');
    });
    
});

//로그인 페이지 설정
app.get('/login', function(req, res){
    res.render('login.ejs');
}); 

//회원가입 페이지 설정
app.get('/addmember', function(req,res){
    res.render('addmember.ejs');
});

//마이페이지 DB값 가져오기
app.get(['/mypage'], function(req,res){

    var sql = 'SELECT * FROM member WHERE id=?';
    var params = [req.session.Display];
        
    connection.query(sql, params ,function(error, rows){
        if(error){
            console.log(error);
        }else{
            var mailstr = rows[0].mail.split("@");
            var mail1 = mailstr[0];
            var mail2 = mailstr[1];

            var birthstr = rows[0].birth.split("/");
            var year = birthstr[0];
            var month = birthstr[1];
            var day = birthstr[2];

           res.render('mypage.ejs', {
            id : rows[0].id,
            password : rows[0].password,
            name : rows[0].name,
            gender: rows[0].gender,
            year : year,
            month : month,
            day : day,
            mail1 : mail1,
            mail2 : mail2,
            phone : rows[0].phone,
            address : rows[0].address,
            wallet_address : rows[0].wallet_address,
            coin : rows[0].coin,
            clienttype : rows[0].clienttype
           });
        }
    });
});

app.get('/trans/:id',function(req,res){//트랜잭션 페이지
    connection.query('select * from member where id = ?',[req.session.Display], function(error,results){
        if(error){
            console.log(error);
        }else{
            connection.query('SELECT * FROM member WHERE id = ?',[req.params.id], function(error, result){
                if(error){
                    console.log(error);
                }else{
                    res.render('transaction.ejs',{
                        session : req.session.Display,
                        data : results[0],
                        target : result[0]
                    });
                }
            });
        }
      });
})

app.post('/trans',function(req,res){
    connection.query("select * from member where wallet_address=?",req.body.target_Address, function(err,results){
        if(err) console.log(err);
        var targetcoin = parseInt(results[0].coin);
        var havecoin = parseInt(req.body.havecoin);
        var amount = parseInt(req.body.amount);

        var sql = 'UPDATE MEMBER SET coin = ? WHERE wallet_address=?';
        var sender = [havecoin-amount , req.body.sender_Address];
        var receiver = [targetcoin+amount , req.body.target_Address];

        connection.query(sql,receiver, function(err,resu){if(err) console.log(err);});
        connection.query(sql,sender, function(err,re){if(err) console.log(err);});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender_Address, req.body.target_Address);
        bitcoin.addTransactionToPendingTransactions(newTransaction);
    
        const requestPromises = [];
        bitcoin.networkNodes.forEach(networkNodeUrl => {
            const requestOptions = {
                uri: networkNodeUrl + '/transaction',
                method: 'POST',
                body: newTransaction,
                json: true
            };
    
            requestPromises.push(rp(requestOptions));
        });

        res.redirect('/view')
    });

    
});

app.get('/view',function(req,res){ // 기부 목록
    connection.query('SELECT * FROM board',function(err,results){
        if(err) console.log(err);
        res.render('view.ejs',{data:results,session:req.session.Display});
    });
});

app.get('/view/:id',function(req,res){ // 기부 목록 눌러서 상세
    connection.query('SELECT * FROM board WHERE num=?',[req.params.id], function(error, results){ //num에 맞는 게시글 가져오기
        if(error) {
            console.log(error)
        }else{
            var hit = results[0].hit + 1;
            connection.query('UPDATE board SET hit=? where num=?',[hit, req.params.id], function(error, results){if(error) console.log(error)}); //조회수 1증가
            connection.query('SELECT wallet_address FROM member where id=?',[results[0].id], function(error, result){ //가져온 게시글의 id와 같은 member의 지갑주소 가져오기
                if(error){
                    console.log(error);
                }else{
                    res.render('viewdetail.ejs', {data : results, wallet_address : result[0].wallet_address, session : req.session.Display});
                }
            })
        }
    });
})

//게시글 작성 페이지
app.get('/create',function(req,res){

    var sql = 'SELECT * FROM member WHERE id=?';
    var params = [req.session.Display];

    connection.query(sql, params, function(error, results){
        if(error){
            console.log(error);
        }else{
            res.render('insert.ejs',{name : results[0].name, session : req.session.Display});
        }
    })
});

//게시글 삭제
app.get('/deleteview/:num', function(req, res){

    var sql = 'DELETE FROM board WHERE num=?';
    var params = [req.params.num];

    connection.query(sql, params, () =>{
        res.redirect('/view');
    });
})
  
//게시글 DB 업로드
app.post('/create', (req, res) => {
    const body = req.body;

    let regist_day = new Date();
    var hit = 0;
    var ip = '0:0:0:0:0:0:0:1';

    var sql = "insert into board(id, name, subject, content, regist_day, hit, ip) values(?, ?, ?, ?, ?, ?, ?)";
    var params = [body.id, body.name, body.subject, body.content, regist_day, hit, ip];

    connection.query(sql , params, () => {
        res.redirect('/view');
        });
  });

//로그인 검증
app.post('/verify', function(req, res){ // 로그인
    var id = req.body.username;
    var pw = req.body.password;
    connection.query('SELECT * FROM member WHERE id=? AND password=?',[id, pw], function(error, results){
        if(error) console.log(error);
        if(results[0] !== undefined){
            req.session.Display = results[0].id;
            
            req.session.save(function() {
                res.redirect('/');
            });
        }else{
            res.send('<script>alert("아이디 또는 비밀 번호가 틀렸습니다.");location.href="/login";</script>');
        }
    });
});

//회원가입
app.post('/processAddMember', function(req,res){
    var id = req.body.id;
    var password = req.body.password;
    var name = req.body.name;
    var gender= req.body.gender;
    var year = req.body.birthyy;
    var month= req.body.birthmm;
    var day = req.body.birthdd;
    var birth = year + "/" + month + "/" + day;
    var mail1 = req.body.mail1;
    var mail2 = req.body.mail2;
    var mail = mail1 + "@" + mail2;
    var phone = req.body.phone;
    var address = req.body.address;
    var getforSHA256 = id+password+name+gender;
    var coin = 0;
    var clienttype = req.body.clienttype;

    let date = new Date();

    var hash = sha256(getforSHA256);

    var sql = 'INSERT INTO member VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    var params = [id, password, name, gender, birth, mail, phone, address, date, hash, coin, clienttype];

    connection.query(sql, params, function(error, rows, fields){
        if(error){
            console.log(error);
        } else{
            res.redirect('/');
        }
    });
});

//회원 정보 수정
app.post('/updatemember', function(req, res){
    var id = req.body.id;
    var password = req.body.password;
    var name = req.body.name;
    var gender= req.body.gender;
    var year = req.body.birthyy;
    var month= req.body.birthmm;
    var day = req.body.birthdd;
    var clienttype = req.body.clienttype;
    var birth = year + "/" + month + "/" + day;
    var mail1 = req.body.mail1;
    var mail2 = req.body.mail2;
    var mail = mail1 + "@" + mail2;
    var phone = req.body.phone;
    var address = req.body.address;

    var sql = 'UPDATE MEMBER SET PASSWORD=?, NAME=?, GENDER=?, BIRTH=?, MAIL=?, PHONE=?, ADDRESS=?, clienttype=? WHERE ID=?';
    var params = [password, name, gender, birth, mail, phone, address, clienttype, id];

    connection.query(sql, params, function(error, results){
        if(error) {
            console.log(error);
        }else{
            res.render('updatememberpage.ejs',{id : id});
        }
    });
});

//회원 탈퇴
app.get('/deletemember', function(req, res){

    var sql = 'DELETE FROM member WHERE id=?';
    var params = [req.session.Display];
        
    connection.query(sql, params ,function(error, rows){
        if(error){
            console.log(error);
        }else{
            delete req.session.Display;
            req.session.save(function(){
                res.render('deletememberpage.ejs'); 
            });
        }
    });
});


//트랜잭션 적용


app.listen(port, function() {
	console.log(`Listening on port ${port}...`);
});





