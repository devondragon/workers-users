# Cloudflare Workers User Framework

## Introduction

Leverage the power of serverless with stateful capabilities using Cloudflare Workers. This project demonstrates how to incorporate session state into stateless serverless applications, providing a foundational framework for applications requiring user management capabilities, such as registration, login, and session management.

This framework is designed to work seamlessly on Cloudflare's serverless platform, offering a scalable, efficient way to manage user sessions and data without compromising on performance.


## Screenshots
![Alt text](/screenshots/login.png?raw=true "Login Page") ![Alt text](/screenshots/register.png?raw=true "Register Page")


### Components
- **session-state**: A Cloudflare Worker that interfaces with a KV store to manage session data.
- **user-mgmt**: A Cloudflare Worker which manages user functionalities (e.g., registration, login) using a D1 database for persistence.
- **account-pages**: A Cloudflare Pages site which demonstrates user registration, login, forgot password, and retreiving session state, with static HTML, JavaScript, and CSS. This is meant to be an example and a place to see or copy code from.


## Installation and Dependencies

### Install Node.js and NPM
You will need to have a Node version of 16.17.0 or later (as required by Wrangler). The Node installation include NPM (the Node Package Manager).

[Install Node.js](https://nodejs.org/en/)


### Clone, Fork, or Download this project
First you should clone (or fork and clone) this repository:

```bash
git clone https://github.com/devondragon/workers-users.git
cd workers-users
```

### Install all Node Packages
Inside the main repo directory:
```bash
npm install
```

This will install [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/) and all other required pacakges in each of the sub-projects


## Setup Cloudflare Infrastructure
There are a few Cloudflare infrastructure pieces that will need to be created. Currently these have to be done manually using Wrangler. It should be possible to automate all of this using Terraform with the Cloudflare provider, but for this project I am keeping things simple.

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
npx wrangler d1 execute users --file=./schema.sql
```



### Pages Application
This [Cloudflare Pages](https://pages.cloudflare.com) application is where the html, css, and js for the front end are deployed to.

```bash
npx wrangler pages project create account-pages
```

You can accept the default name for the production branch, as we'll be deploying to it using Wrangler and Lerna.

If you change the name of this, be sure to update the name in packages/account-pages/wrangler.toml and package.json.


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

I welcome feedback and contributions from the community! Whether you have suggestions for improvements, found a bug, or want to contribute new features, your input is highly valued.

### Reporting Issues
If you encounter any issues or have feedback on how I can improve the framework, please use the GitHub Issues section of our repository. When reporting an issue, try to include as much relevant information as possible, such as:

- A clear and concise description of the issue or suggestion.
- Steps to reproduce the problem (if reporting a bug).
- Any relevant screenshots or error messages.
- Your environment details (e.g., browser version, Cloudflare Workers CLI version).

This information will help us understand and address the issue more effectively.

### Contributing via Pull Requests
I encourage contributions in the form of Pull Requests (PRs). Whether it's a bug fix, a new feature, or improvements to the documentation, your contributions are welcome. Please follow these steps to contribute:

1. **Fork the Repository**: Start by forking the repository to your GitHub account.

2. **Clone the Forked Repository**: Clone the repository to your local machine to start working on your changes.

3. **Create a New Branch**: For each set of changes or new feature, create a new branch in your fork.

4. **Make Your Changes**: Implement your changes, bug fixes, or additional features on your branch. Ensure that your code adheres to the existing code style and that you've tested your changes.

5. **Commit Your Changes**: Make concise and meaningful commit messages that explain the changes you've made.

6. **Submit a Pull Request**: Push your changes to your fork and then submit a pull request to the main repository. In your pull request description, provide a detailed explanation of the changes and why they're needed.

7. **Review Process**: Your pull request will be reviewed by the maintainers. Be open to feedback and be prepared to make further adjustments based on the review.

8. **Merge**: Once your pull request is approved, a maintainer will merge it into the main repository.


## End Note
I am new to NodeJS, Cloudflare Workers, etc..  So if there are better ways to be doing things, let me know:)
