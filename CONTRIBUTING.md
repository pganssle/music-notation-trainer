# Contributing to this project

I would welcome contributions to this project, thank you for your interest! However a note of warning: my time for doing open source is scarce and very bursty, so there is a very high likelihood that issues and PRs that cannot be easily verified or fixed (i.e. ones where it is obvious from mobile that it is an improvement) will languish for months or indefinitely. If this would be dispiriting to you, I recommend not contributing.

HOWEVER, this project is designed to be easily forked, and relies on no central infrastructure! If you want or need a fix, I encourage you to spin up your own github repo and deploy the same project with your own changes (you can host with Github Pages easily and for free).

## Development Setup

Developing this application requires `npm`, `ruby` (with `bundle`) and `Make`. If all three are installed, clone the repo and in the root directory type `make html` to build a production version of the site or `make dev` to build a dev version (with code maps).

My usual development practice is to run `make serve` and open https://localhost:4000, which should automatically rebuild whenever changes are made to the project. Because of the PWA's caching, you may need to make judicious use of hard refreshes (Ctrl + F5) on the browser side.

## Project Structure
```
music-notation-trainer/
├── assets/
│   ├── css/           # Stylesheets
│   ├── js/            # JavaScript source files
│   ├── icons/         # PWA icons
│   └── dist/          # Built assets
├── manifest.json      # PWA manifest
├── sw.js             # Service worker
├── index.html        # Main application page
├── webpack.config.js # Build configuration
└── package.json      # Dependencies and scripts
```

### Build Scripts
- `npm run build`: Production build
- `npm run build:dev`: Development build with source maps
- `npm run build:watch`: Development build with file watching

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Manually test your changes, preferably on a tablet.
5. Submit a pull request

Unfortunately, there are no automated tests in this project at the moment.
