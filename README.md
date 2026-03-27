<<<<<<< HEAD
# SnS-Market
S&amp;S Market Project
=======
# Nega_Reservation
This is a source code for Nega Butchery project. It is a notification system for the bussiness owner to deliver message to the customers when a product is available. Notificaiton is through a Twilio API call.

## Systen Architecture

TBD

## Repo Structure
The notification system is built with an html code (`index.html`). This is the directory structure. 

**Directory Structure**

- `Nega_Reservation/` — Site root
  - `firebase.json` : Firebase hosting config
  - `index.html` : Main landing page
  - `privacy-policy.html` : Privacy policy
  - `Archive/` : Archived/old pages
  - `item/` : Item images for products
  - `logo/` : Logos and branding assets

## CICD - Release Management and Testing

This notificaiton system is deployed in Firebase hosting and integrates soley with github actions for deployment and testing management. Its crucial to understand how the system is setup in firebase and github. 

There is a UAT and Prod environment. One source code is used for both UAT and Prod but the deployment process in github actions is designed to deploy to Prod and UAT based on the actions (eg. git PR creation builds in UAT and PR merge deploys in Prod). To accomplish this the environments are parametrized in `index.html` and during deployment github actions process will use proper values to deploy in prod or UAT based on the actions.

> **ℹ️ Important Notes before working on this repository**
> 
> 1. Always work on a git branch and do not modify the main branch without a peer review and standard process outlined in the next sections.
> 2. Always use your personal gthub account. PLEASE do not use globye email!
> 

### Preparing your coding environemnt

0. In your local if you have not done so, install git and optionally Visual Studio Code.

1. Setup your github account ssh keys

In your local terminal, run the following commands to create your ssh keys
```bash
ssh-keygen -t rsa
```
Press Enter for the default values. This will generate a private and public key pairs in the `~/.ssh` directory. `id_rsa` is your private key and `id_rsa.oub` is your public key. 

2. Import the public key in github SSH settings once you logged in with your account.

Login to github *with your own account*. Under your profile on top right corner, go to *settings* then *SSH and GPG Keys* and click *New SSH key* to create a new ssh key. Give it a Title and in the *Key* section, copy and paste the `~/.ssh/id_rsa.pub` file content.

3. On your local under the `~/.ssh` direcotry, create a file called `config` and copy and paste the following content.

```bash
Host github.com
        Hostname github.com
        user git
        IdentityFile ~/.ssh/id_rsa
```

Now you are ready to clone remote repos locally and work on releases and patching etc...


### Deployment steps

1. Clone remote nega repo locally

```bash
mkdir ~/git_repo
cd ~/git_repo
git clone git@github.com:GlobyteITConsulting/Nega_Reservation.git
```

2. Open the repo in VS Code

```bash
cd ~/git_repo
code Nega_Reservation
```

This will open a visual studio window on Nega_Reservation repo.

3. ** This is very important ** Create a new branch.

On the VS Code, create a terminal and run below commands:

```bash
git pull
git checkout -b <your branch name>
```

Now, you can work on any changes in the code. Save the changes. In VS Code, setup auto-save to make it easier.

3. when ready to push the changes to github, run the command below.

```bash
cd ~/git_hub/Nega_Reservation
git add .
git commit -m '<add your comment on the changes you made>'
git push --set-upstream origin <your branch name>
```

4. In github, under *Nega_Reservation* repo, create a pull request (PR) from your new branch.

Go to *Pull Requests*. Then *New Pull request*. On the *compare* drop down choose your branch. Then, *Create pull request*.

5. The PR action will create a github action that will deploy the code in UAT. To find the firebase preview channel, go to *Actions* and from the list of the *All workflows*, choose your commits. On the left side, on the *Jobs* list, click on *Deploy Preview*. This will show you a the UAT environment URL. This is firebase preview channel URL and its short-lived for a couple days.


[![DO NOT MERGE](https://img.shields.io/badge/DO_NOT_MERGE-REVIEW_REQUIRED-red?style=for-the-badge)](./CONTRIBUTING.md)

>>>>>>> sns-init
