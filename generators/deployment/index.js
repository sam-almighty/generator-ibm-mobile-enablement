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
var formatter ='\n';

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
		this.manifestConfig = {};
		this.manifestConfig.env = {};
		this.toolchainConfig = {};
		this.pipelineConfig = {
			buildJobProps : {artifact_dir: "''"},
			triggersType: 'commit'
		};
		this.testjobconfig= {
			testJobProps :{}
		};


		this.publishjobconfig= {
			publishJobProps : {}
		};
		this.deployment = {type: 'CF', name: this.bluemix.name};

		this.name = this.bluemix.name;
		this.apprepo = this.bluemix.apprepo;
		this.testrepo = this.bluemix.testrepo;
		this.manifestConfig.name = this.bluemix.name;
	

		this.toolchainConfig.repoType = this.opts.repoType || "clone";
		switch (this.bluemix.backendPlatform) {
			case 'SWIFT':
				this._configureSwift();
				break;
			case 'ANDROID':
				this._configureAndroid();
				break;
			default:
				throw new Error(`Language ${this.bluemix.backendPlatform} was not one of the valid languages: NODE, SWIFT, JAVA, SPRING, DJANGO or PYTHON`);
		}
		if (this.manifestConfig && this.manifestConfig.ignorePaths) {
			this.cfIgnoreContent = this.cfIgnoreContent.concat(this.manifestConfig.ignorePaths);
		}
	}

	_configureSwift() {
		this.manifestConfig.buildpack = 'swift_buildpack';
		this.manifestConfig.command = this.bluemix.name ? ("\"\'" + `${this.bluemix.name}` + "\'\"") : undefined;
		this.manifestConfig.memory = this.manifestConfig.memory || '128M';
		this.pipelineConfig.swift = true;
		this.cfIgnoreContent = ['.build/*', '.build-ubuntu/*', 'Packages/*'];
	}

	_configureAndroid() {
		if(this.opts.appName) {
			this.manifestConfig.name = this.opts.appName;
			this.name = this.opts.appName;
		}
	
		this.javahome='export JAVA_HOME=/opt/IBM/java8'
		this.pipelineConfig.buildJobProps = {
			build_type: 'shell',
			script: '|-' + formatter+
			'      #!/bin/bash'+ formatter+
			'      export JAVA_HOME=/opt/IBM/java8'+formatter+
			'      cd /home/pipeline'+ formatter+
	  		'      # Android sdk'+ formatter+
			'      wget https://dl.google.com/android/repository/sdk-tools-linux-3859397.zip'+formatter+
			'      sudo apt-get install unzip'+formatter+
			'      unzip /home/pipeline/sdk-tools-linux-3859397.zip'+formatter+
			'      echo \'y\' | /home/pipeline/tools/bin/sdkmanager --licenses'+formatter+
			'      echo \'y\' | /home/pipeline/tools/bin/sdkmanager "platform-tools" "platforms;android-26"'+formatter+
	  
			'      # Prereq for installing Fastlane: Install RVM'+formatter+
			'      gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB'+formatter+
			'      \\curl -L https://get.rvm.io | bash -s stable --ruby'+formatter+
			'      source /home/pipeline/.rvm/scripts/rvm get stable --autolibs=enable'+formatter+
			'      gem -v'+formatter+
	  
			'      # Install Fastlane'+formatter+
			'      gem install fastlane -NV'+formatter+
	  
			'      # Build the apk file'+formatter+
			'      cd /home/pipeline/$BUILD_ID'+formatter+
			'      fastlane beta'+formatter+
	  
			'      mkdir /home/pipeline/temp'+formatter+
			'      cp ./app/build/outputs/apk/app-release.apk /home/pipeline/temp'+formatter+
			'      mkdir /home/pipeline/appupload'+formatter+
	  
			'      # Push the generated apk for git hub for testing'+formatter+
			'      git config --global user.name $gitPushUser'+formatter+
			'      git config --global user.email $gitPushEmail'+formatter+
			'      git config --global push.default matching'+formatter+
			'      cd /home/pipeline/appupload'+formatter+
			'      git clone https://github.com/sam-almighty/appuploadrepo.git .'+formatter+
			'      ls'+formatter+
			'      rm -rf'+formatter+
			'      cp /home/pipeline/temp/app-release.apk .'+formatter+
			'      git add app-release.apk'+formatter+
			'      git commit -m "released a new version of apk - build : ($BUILD_ID)"'+formatter+
			'      echo $apkGitPushUrl'+formatter+
			'      git push $apkGitPushUrl'
		};
		this.testjobconfig.testJobProps={
			script : '|-' + formatter+
		    '      #!/bin/bash'+formatter+
      		'      cd /home/pipeline/$BUILD_ID/appium/sample-scripts/java'+formatter+
      		'      mvn clean install -X -Dtest=$test -DexecutionType=$executionType -DapiKey=$bitbarApiKey -DapplicationPath=$applicationPath -Dtestdroid_project=$testdroid_project'
		}; 

		this.publishjobconfig.publishJobProps={
			script : '|-' +formatter+
			'      testID=$(curl -H "Accept: application/json" -u $bitbarApiKey -X GET $bitbarAppiumClientSideProject | awk -F\'[:]\' \'{print $3}\' | awk -F\'[,]\' \'{print $1}\')'+formatter+
			'      title="Test Results for build "$testID'+formatter+
			'      body="Check the detail reports here : "$bitbarTestReportLocation$testID'+formatter+
			'      curl -H "Content-Type: application/json" -H "Authorization: Bearer $gitToken" --include --request POST --data "{\"title\": \"$title\", \"body\": \"$body\"}" $issueGitRepo'
		};

	}


	cleanUpPass() {
		if (this.manifestConfig && this.manifestConfig.env && Object.keys(this.manifestConfig.env).length < 1) {
			delete this.manifestConfig.env;
		}
		if (this.cfIgnoreContent) {
			this.cfIgnoreContent = this.cfIgnoreContent.join('\n');
		}
	}

	writing() {
		//skip writing files if platforms is specified via options and it doesn't include bluemix
		if(this.opts.platforms && !this.opts.platforms.includes('bluemix')) {
			return;
		}
		this._copyFilesfunction('nls','.bluemix/nls');
		this._copyFilesfunction('fastlane','.bluemix/fastlane');
		this._copyFilesfunction('deploy.json','.bluemix/deploy.json');
		this._copyFilesfunction('toolchain.png','.bluemix/toolchain.png');
		this._copyFilesfunction('toolchain.svg','.bluemix/toolchain.svg');
		this._copyFilesfunction('icon.svg','.bluemix/icon.svg');
		this._copyFilesfunction('toolchain_dark.png','.bluemix/toolchain_dark.png');
		this._copyFilesfunction('locales.yml','.bluemix/locales.yml');
		// write manifest.yml file
		this._writeHandlebarsFile('manifest_master.yml', 'manifest.yml', this.manifestConfig)

		// if cfIgnnoreContent exists, create/write .cfignore file
		if (this.cfIgnoreContent) {
			this.fs.write('.cfignore', this.cfIgnoreContent);
		}

		// create .bluemix directory for toolchain/devops related files
		this._writeHandlebarsFile('toolchain_master.yml', '.bluemix/toolchain.yml',
			{name: this.name, repoType: this.toolchainConfig.repoType, deployment: this.deployment, apprepo: this.apprepo, testrepo: this.testrepo, timestamp: '{{timestamp}}', prodspacename: '{{form.pipeline.parameters.prod-space}}', prodorgname: '{{form.pipeline.parameters.prod-organization}}', prodregion: '{{form.pipeline.parameters.prod-region}}', prodappname: '{{services.app-repo.parameters.repo_name}}' });

		this._writeHandlebarsFile('deploy_master.json', '.bluemix/deploy.json',
			{deployment: this.deployment});

		this._writeHandlebarsFile('pipeline_master.yml', '.bluemix/pipeline.yml',
			{name: '${APP_REPO}', config: this.pipelineConfig, deployment: this.deployment, testconfig: this.testjobconfig, publishConfig: this.publishjobconfig,apprepo: this.apprepo});
	}

	_writeHandlebarsFile(templateFile, destinationFile, data) {
		let template = this.fs.read(this.templatePath(templateFile));
		let compiledTemplate = Handlebars.compile(template);
		let output = compiledTemplate(data);
		this.fs.write(this.destinationPath(destinationFile), output);
	}

	_copyFilesfunction (src,dest) {
		this.fs.copy(
		  this.templatePath(src),
		  this.destinationPath(dest)
		);
	  }

};
