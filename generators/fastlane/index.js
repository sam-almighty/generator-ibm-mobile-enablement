/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

'use strict';

const Handlebars = require('../lib/helpers').handlebars;
const Generator = require('yeoman-generator');
const Utils = require('../lib/utils');

module.exports = class extends Generator {
	constructor(args, opts) {
		super(args, opts);
		this.opts = opts.cloudContext || opts;
		if (typeof (opts.bluemix) === 'string') {
			this.bluemix = JSON.parse(opts.bluemix || '{}');
		} else if (typeof (opts.bluemix) === 'object') {
			this.bluemix = opts.bluemix;
		}
	}

	configuring() {
		this.packagename = this.bluemix.packagename;
	}

	cleanUpPass() {

	}

	writing() {
		//skip writing files if platforms is specified via options and it doesn't include bluemix
		if(this.opts.platforms && !this.opts.platforms.includes('bluemix')) {
			return;
		}
	
		// create .bluemix directory for toolchain/devops related files
	//	this._writeHandlebarsFile('toolchain_master.yml', '.bluemix/toolchain.yml',
	//		{name: this.name, repoType: this.toolchainConfig.repoType, deployment: this.deployment, apprepo: this.apprepo, testrepo: this.testrepo });
	
	}

	_writeHandlebarsFile(templateFile, destinationFile, data) {
		let template = this.fs.read(this.templatePath(templateFile));
		let compiledTemplate = Handlebars.compile(template);
		let output = compiledTemplate(data);
		this.fs.write(this.destinationPath(destinationFile), output);
	}

	

};
