//Really really useful website, used some stuff from here:
//http://psitsmike.com/2011/10/node-js-and-socket-io-multiroom-chat-tutorial/

// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
 
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
 
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);
var users={};
var socketId = {};
var n=0;
var inHere = "";
var rooms = [{'roomName':'room1'},{'roomName':'room2'},{'roomName':'room3'}];
// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
	socket.on('addUser', function(username){
		//every time a new user is added, store their relevant information and update who is in the room
		var thisUser={};
		socketId[username] = socket.id;
		socket.user = username;
		thisUser.name = username;
		socket.room = 'room1';
		socket.join('room1');
		socket.broadcast.to('room1').emit('update', username + ' has connected to this room');
		socket.emit('updateRoom', rooms, 'room1');
		thisUser.room= socket.room;
		users[username] = thisUser;
		n = Object.keys(users).length;
		if(n==1){
			inHere = inHere.concat(users[username].name);
		}
		else{
			inHere = inHere.concat( " :: " + users[username].name);
		}			
		io.sockets.in('room1').emit('who', inHere);
	});
	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		if(data.message == "/help"){
			socket.emit("message_to_client", socket.user, {message:'What could I possibly help you with' });
		}
		else if(data.message == "/whatisthis"){
			socket.emit("message_to_client", socket.user, {message:'In this chatroom you can join other rooms and talk to people' });
		}
		else if(data.message == "/users"){
			//part of our creative portion, if you type "/users" it'll tell you everyone online, not just
			//who is in the room, kinda like a chat bot
			var newStr1 = "";
			for(var thing in users){
			if(users.hasOwnProperty(thing)) {
				if(n==1){
					newStr1 = newStr1.concat(users[thing].name);
				}
				else{
					newStr1 = newStr1.concat( " :: " + users[thing].name);
				}
			}
		}
		socket.emit("message_to_client", socket.user, {message: newStr1 });
		}
		else if(data.message == "/msg"){
			//part of our creative portion, if you type "/msg", it gives you instructions on how 
			//to use private messages
			socket.emit("message_to_client", socket.user, {message:'To send a private message, go to the right side of the page' });
		}
		else{
			console.log(socket.user+": "+data.message); // log it to the Node.JS output
			io.sockets.in(socket.room).emit("message_to_client", socket.user, {message:data.message }); // broadcast the message to other users
		}
	});
	
	socket.on("switchRoom", function(newRoom){
		//this is for switching in and out of rooms. Update all the relevant user information
		//and update who is in the room you just entered and broadcast to everyone in the previous room you left
		socket.join(newRoom);
		users[socket.user].room = newRoom;
		console.log("in switch room " + users[socket.user].room);
		var newStr = "";
		for(var thing in users){
			if(users.hasOwnProperty(thing)) {
				if(users[thing].room == newRoom){
					if(n==1){
						newStr = newStr.concat(users[thing].name);
					}
					else{
						newStr = newStr.concat( " :: " + users[thing].name);
					}
				}
				else{
					var asdf = inHere.replace(socket.user, "");
					io.in(socket.room).emit('who', asdf);
				}
				console.log("is in this new room" + newStr);
			}
		}	
		socket.emit('update', 'you have connected to ' +newRoom);
		socket.broadcast.to(socket.room).emit('update', socket.user + ' has left this room');
		socket.room = newRoom;
		socket.broadcast.to(newRoom).emit('update', socket.user + ' has joined this room');
		socket.emit('updateRoom', rooms, newRoom);
		io.sockets.in(newRoom).emit('who', newStr);
	});
	
	
	socket.on("addRoom", function(addRoom){
		//add a normal room with no password by pushing it to the json of rooms
		rooms.push({roomName:addRoom});
		console.log(rooms);
		io.emit('addRoom', rooms, socket.room);
	});
	
	socket.on("addWithPw", function(addRoom, pw){
		//add a room with a password by pushing it to the json of rooms
		rooms.push({roomName:addRoom, password: pw});
		console.log(rooms);
		io.emit('addRoom', rooms, socket.room);
	});
	
	socket.on("checkPw", function(newRoom, pwGuess){
		//part of the password protected rooms, check the password guess with the password on file
		for(var i = 0 ;i<rooms.length; i++){
			if(rooms[i].roomName == newRoom){
				if(rooms[i].password == pwGuess){
					console.log("Were in");
					socket.join(newRoom);
					users[socket.user].room = newRoom;
					console.log("in switch room " + users[socket.user].room);
					var newStr = "";
					for(var thing in users){
						if(users.hasOwnProperty(thing)) {
							if(users[thing].room == newRoom){
								if(n==1){
									newStr = newStr.concat(users[thing].name);
								}
								else{
									newStr = newStr.concat( " :: " + users[thing].name);
								}
							}
							else{
								var asdf = inHere.replace(socket.user, "");
								io.in(socket.room).emit('who', asdf);
							}
							console.log("is in this new room" + newStr);
						}
					}
					socket.emit('update', 'you have connected to ' +newRoom);
					socket.broadcast.to(socket.room).emit('update', socket.user + ' has left this room');
					socket.room = newRoom;
					socket.broadcast.to(newRoom).emit('update', socket.user + ' has joined this room');
					socket.emit('updateRoom', rooms, newRoom);
					io.sockets.in(newRoom).emit('who', newStr);
				}
			}
		}
	});
	
	socket.on("dm", function(to, msg){
		//private messages
		var from = socket.user;
		socket.broadcast.to(socketId[to]).emit('whatsup', from, msg);
	});
	
	socket.on("kick", function(who){
		//kick out whoever it is to room1 the default open room
		let socket = io.sockets.connected[socketId[who]];
		socket.leave(users[who].room);
		socket.join("room1");
		socket.emit('updateRoom', rooms, "room1");
		var newStr = "";
		for(var thing in users){
			if(users.hasOwnProperty(thing)) {
				if(users[thing].room == "room1"){
					if(n==1){
						newStr = newStr.concat(users[thing].name);
					}
					else{
						newStr = newStr.concat( " & " + users[thing].name);
					}
				}
				else{
					var asdf = inHere.replace(users[who].name, "");
					io.in(users[who].room).emit('who', asdf);
				}
			}
		}			
		io.sockets.connected[socketId[who]].emit('update', 'you were kicked to room1');
		socket.broadcast.to(users[who].room).emit('update', socket.user + ' has left this room');
		socket.broadcast.to("room1").emit('update', socket.user + ' has joined this room');
		socket.emit('updateRoom', rooms, "room1");
		io.sockets.in("room1").emit('who', newStr);
		console.log(users[who].room);		
	});
	
	socket.on("privateRoom", function(privateRoom){
		//every private room should open a prompt onclick, redirect to that function in the html
		for(var i=0; i<rooms.length; i++){
			console.log(rooms[i].hasOwnProperty('password'));
			if(rooms[i].roomName == privateRoom){
				if(rooms[i].hasOwnProperty('password')){
					socket.emit('tryna', privateRoom);
				}
			}
		}
	});
	
	socket.on("ban", function(who){
		//this is more like "lock out the user" 
		if (io.sockets.connected[socketId[who]]) {
			io.sockets.connected[socketId[who]].disconnect();
		}
	});
	
	socket.on('disconnect', function(){
		//when you exit the page, disconnect
		socket.broadcast.emit('update', socket.user + ' has disconnected');
		socket.leave(socket.room);
		for(var i=0; i<users.length; i++){
			if(users[i].name == socket.user){
				delete users[i];
			}
		}
	});
});

