# Cloudflare Workers User Framework

## Introduction

Leverage the power of serverless with stateful capabilities using Cloudflare Workers. This project demonstrates how to incorporate session state into stateless serverless applications, providing a foundational framework for applications requiring user management capabilities, such as registration, login, and session management.

This framework is designed to work seamlessly on Cloudflare's serverless platform, offering a scalable, efficient way to manage user sessions and data without compromising on performance.


## Screenshots
![Login Page](/screenshots/login.png?raw=true "Login Page") ![Register Page](/screenshots/register.png?raw=true "Register Page")


## Components
- **session-state**: A Cloudflare Worker that interfaces with a KV store to manage session data.
- **user-mgmt**: A Cloudflare Worker which manages user functionalities (e.g., registration, login) using a D1 database for persistence.
- **account-pages**: A Cloudflare Pages site which demonstrates user registration, login, forgot password, and retrieving session state, with static HTML, JavaScript, and CSS. This is meant to be an example and a place to see or copy code from.


## How to use this Framework
Because this project provides utility functions, we recommend forking it, and then cloning your fork as a submodule in a new or existing project. This parent project will contain your project's other Workers, resources, and Pages applications. You can refresh your fork from this repo whenever you want to merge in changes, fixes, and new features from this repo.  Putting you in full control.

If you haven't used git submodules before, it's a feature that allows you to checkout a git repo (in this case your fork of this project) as a sub-directory of another git repo (your main project). You can read more about it here: [Git Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules).

If you plan to use the workers-users framework in multiple projects, you can use branches of your fork to keep a separate version of this framework for each project, as you will need to modify some resource names in this framework to run multiple independant instances of the D1 Users database and KV Session State store.

### Step 1 - Fork First
1) As discussed above the first thing you should do is to fork this repo to your own GitHub!


### With a New Project
The easiest way to use this framework is within a multi package mono repo project using [lerna](https://lerna.js.org). If you're starting from scratch you can initialize a new lerna project.

2) Create a new directory for your project, and navigate inside of it:

```bash
mkdir myproject
cd myproject
```

3) Initialize the lerna project, which also initializes your local git repo:

```bash
npx lerna init
```

4) Create a packages directory for your application's components (Workers, Pages applications, etc...):

```bash
mkdir packages
```

Lerna automatically adds directories under packages to the list of applications it knows about, via the workspaces attribute in the top level package.json file.


5) Checkout your fork of this project as a git submodule inside your new project:

From the top level directory of your new project "myproject":

```bash
git submodule add https://github.com/%YOUR-REPO-PATH%.git
```

6) Add the new submodule's packages to your project
Edit the top level package.json file, and change the workspaces attribute to look like this:

```
"workspaces": [
    "workers-users/packages/*",
    "packages/*"
  ],
```


### With an existing Project
If you have an existing project you want to add the Workers User Framework to, you'll need to move your existing code into directories under a top level packages directory (if it's not already setup like this).

2) Refactor your existing code, if needed, to be in one or more application directories under a "packages" directory in the top level of your project.

3) Add, if needed, the workspaces attribute to your top level package.json file so it looks like this:
```bash
 "workspaces": [
    "packages/*"
  ],
  ```

4) Continue the steps from the New Project section above starting with step #3


### Project Structure
Your project structure should look like this:

```
myproject/
  package.json
  lerna.json
  packages/
    MyFrontEndPagesApp/
    MyWorker1/
    MyWorker2/
  workers-users/
    package.json
    lerna.json
    packages/
      account-pages/
      sessions-state/
      user-mgmt/
...
```

## Installation and Dependencies

### Install Node.js and NPM
You will need to have a Node version of 16.17.0 or later (as required by Wrangler). The Node installation includes NPM (the Node Package Manager).

[Install Node.js](https://nodejs.org/en/)


### Install all Node Packages
Inside the main repo directory:
```bash
npm install
```

This will install [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/) and all other required pacakges in each of the sub-projects


## Setup Cloudflare Infrastructure
There are a few Cloudflare infrastructure pieces that will need to be created. Currently these have to be done manually using Wrangler. It should be possible to automate all of this using Terraform with the Cloudflare provider, but for this project I am keeping things simple.

PLEASE NOTE: If you may wish to use the workers-users framework in more than one application to be deployed in your Cloudflare account, then you should rename the workers to be unique.  You can add a application specific prefix or suffix to the name of each worker, e.g. “myapp-user-mgmt” and “myapp-session-state”.  In the workers-users wrangler.toml update the services binding to use the new name of the session-state worker.

Create the KV and D1 instances with unique app specific names.

Update the KV and D1 bindings in the wrangler.toml files to point to the new correct instances.




### Setup Cloudflare Authentication

[Setup your Cloudflare Authentication at global or project level](CLOUDFLAREAUTH.md).

### KV Store
This [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) is used by the **session-state** Worker to store Session state in.

Note that while it is a global store, there can be a lag in data updates globally. For Session state that is usually not an issue as the user will typically be hitting the same PoP or at least a close one for subsequent requests, meaning the session data should be up to date. However, it is an architectural limitation to be aware of as it may relate to your use cases, load testing, etc...

```bash
npx wrangler kv:namespace create "sessionstore"
```

This will create a KV store and return the binding name and the id of the new KV instance. This id will need to go into the packages/session-state/wrangler.toml file on line 7.

```toml
[[kv_namespaces]]
binding = "sessionstore"
id = "<YOUR_KV_ID_HERE>"
```


### D1 Database
This [Cloudflare D1 Database](https://developers.cloudflare.com/d1/) is used by the **user-mgmt** Worker to persist user information.

```bash
npx wrangler d1 create users
```

This will return information including the database_name and database_id.  Update the values in packages/user-mgmt/wrangler.toml. You can leave the binding as is.

```toml
[[d1_databases]]
binding = "usersDB"
database_name = "users"
database_id = "<YOUR_DB_ID_HERE>"
```

You will need to create the schema for the database.

```bash
cd packages/user-mgmt
npx wrangler d1 execute users --file=./schema.sql --remote
```



### Pages Application
This [Cloudflare Pages](https://pages.cloudflare.com) application is where the html, css, and js for the front end are deployed to.

```bash
npx wrangler pages project create account-pages
```

You can accept the default name for the production branch, as we'll be deploying to it using Wrangler and Lerna.

If you change the name of this, be sure to update the name in packages/account-pages/wrangler.toml and package.json.


I do not recommend using the account-pages Pages application directly other than for initial testing. It’s really there as an example to leverage.  So typically your user UX (registration, forgot password, login, etc…) would be in one (or more) Pages applications under packages/ in your main project root (or running outside of Cloudflare entirely).  But you can copy or reference the client side Javascript from the account-pages application.



## Initial Deployment
Now you are ready to deploy the two Workers and the Pages application to your Cloudflare Edge.

In the root directory of the project, run:

```bash
lerna run deploy
```

This should deploy all three applications.

### Update URLs
The front end Pages application communicates with the REST APIs of the **user-mgmt** Worker application, so you will need to update two Javascript files in the Pages application with the correct URL for your **user-mgmt** Worker.

In the Cloudflare Admin, select the Workers & Pages in the left hand nav.  You should see **user-mgmt** in the list of applications.  Click on it.  Next click on the Triggers tab.  You can see the Routes, Add Routes, and setup Custom Domains for your API.  Setup or pick a default route, so you should have a hostname that is either a Custom Domain of yours, or a Cloudflare domain that ends in workers.dev.

In the Pages application, under packages/account-pages/static/js/, modify api.js file, replacing the API_BASE_URL with the hostname for the Route to your **user-mgmt** Worker.

```javascript
const API_BASE_URL = 'https://user-mgmt.yourdomain.com';
```

If you have the APIs running on a different domain from your front end website, you can run into issues where browsers will refuse to load cookies from the API domain, which is needed for session management. For instance, Safari's "Prevent cross-site tracking" setting will block this.

It is best if you can run the **user-mgmt** Worker, and hence the API, on the same domain as the website you plan to use the APIs from, just under a path like /user-api/ or something similar. You can do this by configuring a [Route](https://developers.cloudflare.com/workers/platform/routes/#matching-behavior) for the **user-mgmt** Worker.  In that case you'll want to use the example in api.js that looks like this:

```javascript
const apiBaseUrl = `${window.location.protocol}//${window.location.host}/user-api`;
```

Now you'll need to redeploy the Pages application.  You can do this by re-running the "lerna run deploy" command in the project's root directory, or by running the following, while inside packages/account-pages/

```bash
npx wrangler pages deploy static
```

## Configuring Email
For the Forgot Password flow to work, you'll need to have outbound emails sent from the **user-mgmt** Worker.

In this repo, the Worker is setup to use the free MailChannels sending option only available from Cloudflare Workers.

The setup for that is covered here: [Email Setup Guide](EMAILSETUP.md)

## Role-Based Access Control (RBAC)

The framework includes an optional Role-Based Access Control system that allows you to implement fine-grained permissions in your applications. RBAC provides:

- **Flexible Permission Management**: Define custom permissions using a hierarchical `resource:action` format
- **Role Assignment**: Create roles and assign them to users with specific permission sets
- **API Integration**: Built-in REST endpoints for managing roles and permissions
- **Optional Implementation**: RBAC can be enabled or disabled based on your needs

### Quick Start

1. Enable RBAC in your `wrangler.toml`:
   ```toml
   [vars]
   RBAC_ENABLED = "true"
   RBAC_DEFAULT_ROLE = "user"
   ```

2. Run the RBAC database migration:
   ```bash
   cd packages/user-mgmt
   npx wrangler d1 execute users --file=./migrations/rbac.sql --remote
   ```

3. Deploy the updated worker:
   ```bash
   npm run deploy
   ```

For detailed configuration, migration guides, API documentation, and usage examples, see the comprehensive [RBAC Documentation](RBAC.md).

## Accessing and Testing
Now you should be able access your deployed Account Pages Application, with the basic front end.  You can find the URL, and setup your own Custom Domains and more, in the Cloudflare web admin, under Workers & Pages, and select the "account-pages" Pages Application.

When you visit the URL of the latest Production Deployment of the Pages Application, you should see a basic login form, with a link to Register underneath.  You can register an account, and then after that is sucessful you can login.

Once logged in, you can use the link on the bottom of the page to visit loggedin.html, which has a button that will fetch your user data from the current session, via the **session-state** Worker.  Please see the [sequence diagrams](DIAGRAMS.md) more info.


## Local Development
Note: This is still under development, and there are some issues with running everything locally at the moment.

In the Pages application, under packages/account-pages/static/js/, modify api.js file, commenting out the real API_BASE_URL with the hostname for the Route to your **user-mgmt** Worker and uncomment the Dev API_BASE_URL which is pointing to localhost.

Then in the main project root run

```bash
lerna run dev
```

You can access the front end at: [http://localhost:48080](http://localhost:48080)

## Project Structure and Deployment
Because this project consists of two Workers and one Pages application, I am using [Lerna](https://lerna.js.org) to manage multiple JavaScript packages from a single repository.

You can read more about using Lerna with Cloudflare Worker projects here: [https://developers.cloudflare.com/workers/tutorials/manage-projects-with-lerna/](https://developers.cloudflare.com/workers/tutorials/manage-projects-with-lerna/).

Each Worker package and Pages application was created using Wrangler and can managed, run, and deployed using Wrangler from within the specific package directory under packages/. I have setup a package.json under the account-pages Pages application to allow Lerna to run and deploy the Pages application along with the Workers.

I am using [TypeScript](https://www.typescriptlang.org) for the Workers' code.


## Feedback and Contribution

I welcome feedback and contributions from the community! Whether you have suggestions for improvements, found a bug, or want to contribute new features, your input is highly valued. I am new to NodeJS, Cloudflare Workers, etc..  So if there are better ways to be doing things, let me know:)

### Contributing
[Contributing Guide](CONTRIBUTING.md)

### Reporting Issues
If you encounter any issues or have feedback on how I can improve the framework, please use the GitHub Issues section of our repository. When reporting an issue, try to include as much relevant information as possible, such as:

- A clear and concise description of the issue or suggestion.
- Steps to reproduce the problem (if reporting a bug).
- Any relevant screenshots or error messages.
- Your environment details (e.g., browser version, Cloudflare Workers CLI version).

This information will help us understand and address the issue more effectively.
