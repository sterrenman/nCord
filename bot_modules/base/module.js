module.exports = {
	
	initializeModule: function(mod){

		//set name
		this.module = mod;

        //subscribe to bot events
		bot.subscribeEvent(this, 'ready');
		

	},

	onEvent: function(event, data){

		//this is where registered events will be received
        if(event == 'ready'){

			bot.log("Logged in as " + client.user.tag);
			bot.log(chalk.cyan(`Using discord.js ` + Discord.version));
			
			bot.setStatus("Ready");
			bot.log("config validation completed.");
			client.shard.send({type:"action/post", message: null })

			if(!client.user.bot){
				bot.selfbot = true;
				bot.log(chalk.yellow('This token belongs to a user account, Activating selfbot mode.'))
			}

		}

	}
	
}