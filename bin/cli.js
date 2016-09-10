#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const del = require('rimraf')
const exec = require('child_process').exec
const execSync = require('child_process').execSync
const inquirer = require('inquirer')
const chalk = require('chalk')
const prompt = inquirer.createPromptModule()
const GIT_REPO = 'https://github.com/ngnjs/chassis-boilerplate.git'

const mkdirp = function (dir) {
  try {
    fs.accessSync(dir, fs.F_OK)
    return
  } catch (e) {
    try {
      fs.accessSync(path.join(dir, '..'), fs.F_OK)
      fs.mkdirSync(dir)
    } catch (ee) {
      mkdirp(path.join(dir, '..'))
    }
  }
}

prompt([{
  name: 'name',
  message: 'Project Name:',
  type: 'input',
  required: true,
  default: 'myapp'
}, {
  name: 'root',
  message: 'Project Root:',
  type: 'input',
  default: function (answers) {
    return path.resolve(path.join(process.cwd(), answers.name))
  }
}, {
  name: 'overwrite',
  message: 'That directory already exists. Do you want to overwrite it?',
  type: 'confirm',
  default: false,
  when: function (answers) {
    try {
      fs.accessSync(answers.root)
      return true
    } catch (e) {
      return false
    }
  }
}, {
  name: 'mkdir',
  message: 'The root directory does not exist. Do you want to create it?',
  type: 'confirm',
  default: true,
  when: function (answers) {
    if (answers.overwrite) {
      return false
    }
    try {
      fs.accessSync(path.dirname(answers.root), fs.R_OK)
      return false
    } catch (e) {}
    return true
  }
}, {
  when: function (answers) {
    if (!answers.mkdir && !answers.overwrite) {
      console.log(chalk.red.bold('No valid directory selected. Aborting.'))
      process.exit(0)
    }
    return false
  }
}, {
  name: 'scope',
  message: 'CSS Scope:',
  default: function (answers) {
    return answers.name.replace(/[^A-Za-z0-9_-]/gi, '')
  }
}, {
  name: 'ngnx',
  message: 'Do you want to use the NGN extension library? (Drivers, Loaders, State Mgmt)',
  type: 'confirm',
  default: false
}, {
  name: 'data',
  message: 'Do you want to use NGN data models/stores in your app?',
  type: 'confirm',
  default: true,
  when: function (answers) {
    return !answers.ngnx
  }
}, {
  name: 'wc',
  message: 'Which of the following (if any) Chassis web components would you like to use? (http://ngnjs.github.io/chassis-components/documentation/)',
  type: 'checkbox',
  choices: [{
    name: 'Cycle',
    value: 'chassis-cycle'
  }, {
    name: 'Layout',
    value: 'chassis-layout'
  }, {
    name: 'Advanced List Control',
    value: 'chassis-list'
  }, {
    name: 'Overlays (modals)',
    value: 'chassis-overlay'
  }]
}]).then((answers) => {
  if (answers.overwrite) {
    del.sync(answers.root)
  }

  // Make sure root exists
  mkdirp(path.join(answers.root, '..'))

  const cmd = 'git clone ' + GIT_REPO + ' \"' + answers.root + '\"'
  console.log('\n  Executing', chalk.bgBlack.gray.bold(cmd.trim()), '\n')

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      throw err
    }

    console.log(chalk.gray('  Customizing package.json...'))
    let pkg = require(path.join(answers.root, 'package.json'))
    pkg.name = answers.name.replace(/[^A-Za-z0-9_-]/gi, '')
    pkg.description = answers.name + ' web app.'
    pkg.private = true

    let user = execSync('git config --global --get user.name').toString().trim()
    let email = execSync('git config --global --get user.email').toString().trim()

    pkg.author = {
      name: 'Unknown'
    }

    if (user.trim().length > 0) {
      pkg.author.name = user
    }

    if (email.trim().length > 0 && email.trim().indexOf('@') >= 0) {
      pkg.author.email = email
    }

    fs.writeFileSync(path.join(answers.root, 'package.json'), JSON.stringify(pkg, null, 2))

    console.log(chalk.gray('  Customizing HTML template'))
    let content = fs.readFileSync(path.join(answers.root, 'src', 'index.html')).toString()
    content = content.replace('<h1>NGN Chassis Showroom</h1>', '<h1>' + answers.name + '</h1>')
    content = content.replace(/<title.*\/title>/i, '<title>' + answers.name + '</title>')
    content = content.replace('<body class="ngn chassis template">', '<body class="ngn chassis ' + pkg.name + '">')

    let js = '<!-- LIVERELOAD -->'
    if (answers.ngnx) {
      js = js + '\n\t\t<script src="https://cdn.author.io/ngnx/latest/chassis.x.min.js"></script>'
    } else if (!answers.data) {
      content = content.replace('<script src="https://cdn.author.io/ngn/latest/chassis.min.js"></script>', '<script src="https://cdn.author.io/ngn/latest/chassis.slim.min.js"></script>')
    }

    if (answers.wc.length > 0) {
      js = js + '\n\t\t<script src="https://cdn.jsdelivr.net/webcomponentsjs/latest/webcomponents.min.js"></script>'

      answers.wc.forEach(wc => {
        js += '\n\t\t<script src="https://cdn.author.io/chassis/components/latest/' + wc + '.min.js"></script>'
      })
    }

    content = content.replace('<!-- LIVERELOAD -->', js)

    fs.writeFileSync(path.join(answers.root, 'src', 'index.html'), content)

    console.log(chalk.gray('  Customizing SASS starter file.'))
    content = fs.readFileSync(path.join(answers.root, 'sass', 'main.scss')).toString()
    content = content.replace('.template {', '.' + pkg.name + ' {')
    fs.writeFileSync(path.join(answers.root, 'sass', 'main.scss'))

    console.log(chalk.gray('  Cleanup git files.'))
    del.sync(path.join(answers.root, '.git'))

    console.log(chalk.gray('  Setting up development environment...'))
    execSync('npm i', {
      cwd: answers.root
    })

    console.log('\n', chalk.bgBlack.white.bold(' Project Directory:') + ' ' + chalk.bgBlack.green.bold(answers.root))
    console.log(chalk.bgBlack.white.bold('  Navigate to the'), chalk.bgBlack.green.bold('project directory'), chalk.bgBlack.white.bold('and run'), chalk.bgBlack.magenta.bold('npm start'), chalk.bgBlack.white.bold('to begin working.'))
    console.log('\n', chalk.bgBlack.white(' If you want livereload alerts, execute'), chalk.bgBlack.magenta.bold('npm start --notify'), chalk.bgBlack.white('instead.'), '\n')
  })
})
