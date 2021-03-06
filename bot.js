// LOAD MODULES
try{
    
    //Discord.js Base
    Discord     = require("discord.js");
    client      = new Discord.Client();
    
    //all of the yes
    chalk       = require('chalk');
    fs          = require('fs');
    request     = require('request');
    mysql       = require('mysql');
    path        = require('path')

    cmds = {};
    langs = {};
    modules = {};
    bot = {};
    bot.status = "Starting";
    bot.cache = {};
    bot.stats = { uptime: 0, commandsExecuted: 0}
    bot.selfbot = false;
    bot.terminating = false;

}catch(ex){
    
    console.error(ex);
    
    console.error('\x1b[31m' + 'FATAL ERROR:');
    console.error(' Cannot load required bot modules.');
    console.error(' Try running "npm install" and try again.\x1b[0m');
    process.exit();
}

try{
    
    cfg = require('./config.json');

	knex = require('knex')({
		client: 'mysql',
		connection: {
			host : 		cfg.mysql.hostname,
			user : 		cfg.mysql.username,
			password : 	cfg.mysql.password,
			database : 	cfg.mysql.database
		}
    });
    
}catch(ex){
    
    console.error(chalk.red('FATAL ERROR:'));
    console.error(chalk.red(' Cannot load config.json'));
    process.exit();
    
}

bot.log = function(text) {
    client.shard.send({type:"log/default", message: text })
}

bot.paniclog = function(type, text){

    if(type == "error"){
        client.shard.send({type:"dlog/error", message: text, author: null })
        return;
    }

    if(type == "feedback"){
        client.shard.send({type:"dlog/feedback", message: text, author: null })
        return;
    }

}
bot.formattime = function(input){ return input };
bot.setStatus = function(text) {

    client.shard.send({
        type:"status/update", 
        guilds: client.guilds.array().length, 
        channels: client.channels.array().length, 
        members: client.users.array().length, 
        cmds: bot.stats.commandsExecuted, 
        uptime: bot.formattime(bot.stats.uptime),
        status: text 
    })

    bot.status = text;
}
bot.setStatus("Starting...");

bot.message = function(type, message){
    if(type == 'in'){ client.shard.send({type:"log/incmsg", message: message.cleanContent }) }
}

bot.log('Starting bot...');
bot.getClient = function(){ return client }

bot.eventListeners = {}
bot.subscribeEvent = function(mod, event){
    if(bot.eventListeners[event] == undefined){
        bot.eventListeners[event] = [];
    }

    bot.eventListeners[event].push(mod.module);

};

bot.onEvent = function(event, data){

    
    if(event != '*'){
        bot.onEvent('*', data);
    }

    if(bot.eventListeners[event] == undefined){
        bot.eventListeners[event] = [];
    }

    bot.eventListeners[event].forEach(listener =>{
        modules[listener].onEvent(event, data);
    })

};

bot.L = function(config, section, value, data = null){

    var usecfg = config

    if(langs[config.lang] == undefined){ usecfg.lang = 'en_US' }

    var result = langs[usecfg.lang][section][value]

    if(result == undefined){ 
        result = langs['en_US'][section][value] 
    }
	
    var langstring = result.replace("$1", data);

    return langstring;

}

bot.commandChecks = [];
bot.addCommandCheck = function(func){

    if(func == undefined){
        bot.log(chalk.orange('Adding command check failed, No function supplied!'))
        return;
    }

    bot.commandChecks.push(func);

};

bot.handleCommandChecks = function(message, cfg, cb){

	//create copy of checks to work with.
    var checks = bot.commandChecks;
    var i = 0;
	
	var doLoop = function(checkFailed, i){
		
		if(i == checks.length-1 && checkFailed == false){ cb(true, message, cfg); }
		if(checkFailed == true){ cb(false, message, cfg); }
		
		bot.commandChecks[i](message, cfg, (result)=>{
            checkFailed = !result;
            i++
			doLoop(checkFailed, i);
		}).catch(err => {
            bot.log(chalk.red('CommandCheck returned an error!'));
            bot.log(err);
        })
		
	}
	
	doLoop(false, 0);

    bot.commandChecks.push(func);

};

bot.aliases = [];
bot.addAlias = function(command, alias){

    bot.aliases[alias] = command.trigger;
    //bot.log('Alias "'+alias+'" for command "' + command.trigger + '" added')

};

bot.reply = function(message, content, embed = {}){ message.channel.send(content, embed); }


//load all language files
bot.loadLang = function(){
	fs.readdir(__dirname + '/lang/', (err, files) => {
		files.forEach(file => {
			try{

				bot.log('Loading Language: ' + file);

				tempJS  = fs.readFileSync(__dirname + '/lang/' + file);
				temp    = JSON.parse(tempJS);

				if(temp.lang_version == cfg.discord.lang_ver){
					langs[temp.lang_short] = temp
				}else{
					bot.log(chalk.red('Skipped Language ' + file + " (Incorrect Version)"));
				}

				
		  
			}catch(ex){
				bot.log(chalk.red('Language ' + file + " failed: ") + ex);
			}
		});
	})
}

bot.loadLang();

// Config & Node-Modules loaded
// Lets start identifying bot modules.
var botModules = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory()) //thx @pravdomil
var modulesInit = botModules(__dirname + '/bot_modules/');

modulesInit.forEach(mod =>{

    bot.log('Loading Module: ' + mod);

    //module 'mod' is about to be loaded.
    modules[mod] = require(__dirname + '/bot_modules/' + mod + '/module.js');
    modules[mod].initializeModule(mod);

    //now lets get the commands from said module
    fs.readdir(__dirname + '/bot_modules/' + mod + '/commands/', (err, files) => {
        files.forEach(file => {
            try{

                bot.log('Loading Command: ' + file);

                temp = require(__dirname + '/bot_modules/' + mod + '/commands/' + file);
                cmds[temp.trigger] = temp
                cmds[temp.trigger].module = mod;
                cmds[temp.trigger].commandInitialization(temp.trigger);
            }catch(ex){
                bot.log(chalk.red('Loading Module ' + mod + " failed: ") + ex);
                console.log(ex);
            }

            

        });
    })

})

bot.onEvent('prelogin', null);

// if someone reads this please dont yell at me for this i didn't know better ok?
client.on('message',                            evnt            => { bot.onEvent('message', evnt);});

client.on('channelCreate',                      evnt            => { bot.onEvent('channelCreate', evnt);});
client.on('channelDelete',                      evnt            => { bot.onEvent('channelDelete', evnt);});``
client.on('channelPinsUpdate',                  (evnt, time)    => { bot.onEvent('channelPinsUpdate', {evnt, time});});
client.on('channelUpdate',                      (evnt, old)     => { bot.onEvent('channelUpdate', {evnt, old});});

client.on('clientUserGuildSettingsUpdate',      evnt            => { bot.onEvent('clientUserGuildSettingsUpdate', evnt);});
client.on('clientUserSettingsUpdate',           evnt            => { bot.onEvent('clientUserSettingsUpdate', evnt);});

client.on('emojiCreate',                        evnt            => { bot.onEvent('emojiCreate', evnt);});
client.on('emojiDelete',                        evnt            => { bot.onEvent('emojiDelete', evnt);});
client.on('emojiUpdate',                        evnt            => { bot.onEvent('emojiUpdate', evnt);});

client.on('error',                              evnt            => { bot.onEvent('error', evnt);});
client.on('disconnect',                         evnt            => { bot.onEvent('disconnect', evnt);});
client.on('ready',                              ()              => { bot.onEvent('ready', null); });

client.on('guildBanAdd',                        (evnt, user)    => { bot.onEvent('guildBanAdd', {evnt, user});});
client.on('guildBanRemove',                     (evnt, user)    => { bot.onEvent('guildBanRemove', {evnt, user});});

client.on('guildCreate',                        (evnt)          => { bot.onEvent('guildCreate', evnt);});
client.on('guildDelete',                        (evnt)          => { bot.onEvent('guildDelete', evnt);});


//debug info
client.on('debug', info => {
    if(cfg.debug == true){
        client.shard.send({type:"log/debug", message: info })
    }
});

//command processing
client.on('message', msg => {

    msg.cmds = cmds;

    //Handle command checks
	bot.handleCommandChecks(msg, cfg, (checkResult, message, cfg)=>{

        cmds = message.cmds

        if(!checkResult){ return; }

		//get prefix
		var prefix  = cfg.discord.prefix;

		//remove prefix from string
		message.content = message.content.replace(prefix, '');
	   
		//create arguments
		message.arguments =  message.content.split(/ +(?=(?:(?:[^"]*"){2})*[^"]*$)/g);


        try{

            //check if alias exists
            if(typeof bot.aliases[message.arguments[0]] == 'string'){

                //run alias
                message.cmds[bot.aliases[message.arguments[0]]].triggerCommand(message, message.arguments);
                bot.log('Executed aliased command ' + message.arguments[0] + ' for user ' + message.author.tag);
                bot.stats.commandsExecuted++;
                return;

            }
            
            //check if command exists
            if(typeof message.cmds[message.arguments[0]] == 'object'){

                //Direct Command
                message.cmds[message.arguments[0]].triggerCommand(message, message.arguments);
                bot.log('Executed command ' + message.arguments[0] + ' for user ' + message.author.tag);
                bot.stats.commandsExecuted++;
                return;

            }
            
        }catch(ex){

            bot.log(chalk.red('CommandExecution returned an error!'));
            console.log(chalk.red(ex.stack));

        }
			
	}).catch(err => {

        bot.log(chalk.red('CommandExecution returned an error!'));
        bot.log(chalk.red(err.message));

    })

    
});

client.options.disabledEvents = ['TYPING_START']
client.login(cfg.discord.token);

process.on('uncaughtException', function(error) {

    bot.log(chalk.red("Shard going down due to an error!"));
    bot.log(chalk.red(error.message));

    fs.writeFile("./err.log", error.stack, function(err) {

        process.stderr.write('', function () {
            process.exit(1);
        });

    });

});

bot.formattime = function(time){
    if(time < 60){
        return time + " Seconds"
    }

    if(time < 3600){
        return Math.round(time/60) + " Minutes"
    }

    return Math.round(time/60/60) + " Hours"
}

setInterval(()=>{
    bot.stats.uptime++;
    bot.setStatus(bot.status);
},1000)

process.on('unhandledRejection', (reason, p) => {

    bot.log(chalk.red( 'Promise Error: ' + reason ))

    fs.writeFile("./err.log", reason.stack, function(err) {

    });

 });

 
bot.getChannel = function(input, guild){

	var ch = guild.channels.find( (item)=> { try{ return item.name.toLowerCase() === input.toLowerCase() }catch(ex){ return null }});
	if( ch != null && typeof ch != undefined) { return ch }

	
    var ch = guild.channels.get(input);
    if(typeof ch != null && typeof ch != undefined){ return ch; } 

    return input;

}
