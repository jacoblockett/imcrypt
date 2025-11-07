<div align="center">
<img src="build/appicon.png" alt="App Icon" width="100">
<p><h1>Imcrypt</h1></p>
</div>

Ever wanted a password manager that uses encrypted photosteganography? I didn't think so, but I made it anyway. Specifically, I wanted a bunch of features that many other managers just didn't seem interested in supporting, namely custom generation rule logic, and this was the storage medium I decided to get gimicky with. There're still a ton of features and updates to be made, but it's at a point now that I can actually make use of it, offering the basics in password management. I don't have a whole lot of time to spend on this project at the moment so development might be slow, but I'll try to keep up with critical issues and PR's should they arise.

> ⚠️ _See [disclaimers](#disclaimers) before use!_

## Current Features

- OTP TFA login support
- Session time-out (10 minutes)
- Sorting and searching (fuzz-tasticly)
- Group (vault) management
- Custom password generation rule wizard (with plenty of room for additional rules)
- Password expiry
- Password reuse prevention

## Planned Features (as time permits)

- Group/vault reordering (drag-n-drop), sorting, filtering (persistence preferable)
- Importing/exporting, both native and external clients. Planned formats include CSV, JSON, XML
- A separate password generation page/panel so you don't have to "create" a password just to use generation logic
- Visual indicators/alerts for flagged passwords, such as passwords being expired, breached, etc.
- Breach detection
- Fields for OAuth and security questions
- Additional item type support. Planned items include Identifications (ID/Passport/etc), Encrypted notes, Bank card information
- Streamlined (and name-corrected) sorting and filtering fields
- Better accessibility and keyboard support (some implemented, but a bit buggy)
- Settings, such as themes, custom session timeout limits, etc.
- A logo...

## Help Wanted

- Testing in general 😅

## Download and Use

> ⚠️ _See [disclaimers](#disclaimers) before use!_

Visit the releases page to find the current release. Currently, only Windows is supported in the releases. You can also build from source.

This project uses Wails v2 with a React frontend. General knowledge of web development and Go programming are highly recommended. To build from source, ensure you have [Wails v2](https://wails.io/docs/gettingstarted/installation/) installed on your machine. Following their installation instuctions should get you up and running. Don't forget to follow their platform-specific instructions as well. Once you have that done, clone this repository by clicking on the green dropdown button on the top right of the page that says "Code". If you have [git](https://git-scm.com/downloads) installed, you can use the CLI, otherwise just download the zip and extract. Open the project's home directory in your preferred command line and run

```bash
wails build # to build from source
wails dev   # to run the development environment
```

The former will build an executable and the latter will auto-launch the application in dev-mode, complete with hot-reload.

## Disclaimers

> ⚠️ I have no experience in cybersecurity. I've done my best effort in making this app as secure as I can, but I can't guarantee anything. If you have experience in cybersecurity, **especially** in offline password managers, and you notice anything non-standard or vulnerable, please submit an issue as soon as you can!

I make no guarantees about this software's stability, and probably never will. Sole use of this software without having a backup of your data stored elsewhere is so incredibly discouraged I can't find a suitable adjective in the English language strong enough. You risk your data being corrupted by one tiny bug hidden in an arbitrary mess of unforeseen user actions, unrecoverable until the end of time. I know, you know, and we all know how valuable your password data is. Losing them to something silly would be beyond frustrating - it might even be damaging to your well-being. **So please, for the love of everything, backup your data somewhere else at every given moment and do not rely on this software as your single source of truth.**
