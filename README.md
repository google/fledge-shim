# FLEDGE Shim

We're building a pure-JavaScript implementation of the
[FLEDGE proposal](https://github.com/WICG/turtledove/blob/master/FLEDGE.md), on
top of existing browser APIs. The goal is to allow testing as much of FLEDGE as
possible, in as realistic a manner as possible, given the constraint of not
being able to add new features to the browser itself.

## Status

This project has not yet been tested in production; use at your own risk.
Furthermore, most of the API is not yet implemented.

## Building

As with most JavaScript projects, you'll need Node.js and npm. Install
dependencies with `npm install` as per usual.

In order to build the frame, you have to set a list of allowed URL prefixes for
the worklets. The frame will only allow `biddingLogicUrl` and `decisionLogicUrl`
values that start with those prefixes. Each such prefix must consist of an HTTPS
origin optionally followed by a path, and must end with a slash. So, for
instance, you could allow worklet scripts under `https://dsp.example`, or
`https://ssp.example/js/`.

The reason for this is because worklet scripts have access to cross-site
interest group and related data, and nothing prevents them from exfiltrating
that data. So, if you're going to host the frame and have such cross-site data
stored in its origin in users' browsers, you should make sure to only allow
worklet scripts from sources that you trust not to do that.

Once you have an allowlist, set the `ALLOWED_LOGIC_URL_PREFIXES` environment
variable to the allowlist with the entries separated by commas, then run
`npm run build`. For example, on Mac or Linux, you might run
`ALLOWED_LOGIC_URL_PREFIXES=https://dsp.example/,https://ssp.example/js/ npm run build`;
on Windows PowerShell, the equivalent would be
`$Env:ALLOWED_LOGIC_URL_PREFIXES = "https://dsp.example/,https://ssp.example/js/"; npm run build`.

## Design

FLEDGE requires a way to store information in the browser that is (a) accessible
across all websites but (b) only through JavaScript access control.
`localStorage` in a cross-origin iframe fits this well. In Chrome this is not
partitioned and only JavaScript running within the iframe can read or modify the
data.

The shim is divided into two pieces:

- A _frame_ that's embedded onto the page cross-origin in an `<iframe>` tag,
  e.g., `<iframe src="https://fledge-shim.example/0.1.html">`.

- A _library_ that consumers use to communicate with the frame over
  `postMessage`.

Almost all of the work happens in the frame; the library is a small adapter that
translates the API from functions to messages.

## API

We're planning to implement the API as closely as possible to what is presented
in the explainer, but some aspects necessarily differ due to the constraints of
running on publisher and advertiser pages, and implementing without browser
changes.

### On-Page API

To make the API available on a page consumers will compile the library into
their code. We're thinking of making it available as an NPM package, or people
can pull from github manually.

#### Initialization

The library needs to know how to load the frame on the page.

```javascript
const fledgeShim = new FledgeShim("https://fledge-polyfill.example/0.1.html");
```

The version number of the frame must match that of the library; this is checked
at runtime.

#### Joining Interest Groups

```javascript
fledgeShim.joinAdInterestGroup(myGroup, 30 * kSecsPerDay);
```

Initially, only `owner`, `name`, `user_bidding_signals`, and `ads` will be
supported. We also plan to support for `daily_update_url` and
`trusted_bidding_signals_*`, and at least the `report_win` portion of
`bidding_logic_url`. See the worklet discussion below for more on
`bidding_logic_url`.

The `daily_update_url` is supported, but because we cannot actually run updates
in the background as the browser would, we will only be able to fetch updates on
days when the polyfill loads on some page.

For trusted bidding signals, we'll need to implement our own caching of
responses, since we read FLEDGE as caching at the per-key level. We'll need to
parse caching response headers, but we might limit the range of formats we
accept.

#### Initiating an On-Device Auction

```javascript
// auctionWinnerUrl is an opaque token, and not the real rendering url
const auctionWinnerUrl = await fledgeShim.runAdAuction(myAuctionConfig);
```

All auction configuration options will be supported, but `decision_logic_url`
(see worklet discussion below) will initially only handle `report_result`.

#### Rendering a winning ad

```javascript
const adFrame = document.createElement("iframe");
adFrame.src = auctionWinnerUrl;
// set whatever further attributes you like on adFrame
document.getElementById("ad-slot-div").appendChild(adFrame);
```

Because fencedframes don't exist yet, this will render the ad in an ordinary
iframe. The shim will not be realistic in testing the security, privacy,
performance, or other attributes of fencedframes, since it won't use them at
all.

The `auctionWinnerUrl` will be the same URL as the FLEDGE Shim frame, with a
randomly generated token appended in the fragment. When rendered with such a
token in its URL fragment, the FLEDGE Shim frame will create a nested iframe
inside itself pointing at the original `renderUrl`. This only works from the
same page that called `runAdAuction`.

### Worklets

#### Buyer and Seller Logic

The proposal allows buyers and sellers to provide custom JavaScript
(`generate_bid`, `score_ad`) which will have access to interest group
information. That access is compatible with the privacy model, because these
worklets are heavily locked down, have no network access, and operate as pure
functions. We are not aware of any secure way to execute arbitrary JavaScript
while protecting information from exfiltration. Initially, we are planning to
require buyers and sellers to check their logic into this repo. Later, we may be
able to use Web Assembly or something custom to avoid that requirement.

Users may wish to test FLEDGE in circumstances where the privacy guarantees are
not necessary, such as internal end-to-end testing. We will probably build
support for running custom JavaScript in WebWorkers, behind a compile-time
"testing only" flag.

#### Reporting

Because the MVP allows event level reporting, we do not need the same level of
protection for reporting worklets. The `report_result` and `report_win`
functions will be invoked as described in the spec.

## Stages

We are planning to implement this in stages, trying to have a version that is
minimally useful as early as possible. Our current planned stages are:

### V1

Implement core functionality:

- `joinAdInterestGroup`
- `leaveAdInterestGroup`
- `runAdAuction`

Bidding and auction logic will be hardcoded; currently, each ad simply has a
static price, and the ad with the highest price wins.

#### V2

Implement network functionality: respecting `daily_update_url` and
`trusted_bidding_signals_url`.

#### V3

Implement bidding and auction logic: respecting `bidding_logic_url` and
`decision_logic_url`.

#### V4

Reporting. Respect `report_result` and `report_win`.

## Fidelity

- Performance: While we will build the shim in a manner as performant as
  possible, you should not generally expect the performance characteristics of
  the shim to be realistic.

- K-Anonymity: We don't intend to implement any of the k-anonymity restrictions.
  Implementing these restrictions requires either peer-to-peer browser
  interactions or a trusted server. We may revisit this once Chrome announces
  how they intend to implement it.
