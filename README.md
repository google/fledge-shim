# FLEDGE Shim

We're building a pure-JavaScript implementation of the [FLEDGE
spec](https://github.com/WICG/turtledove/blob/master/FLEDGE.md), on top of
existing browser APIs. The goal is to allow testing as much of FLEDGE as
possible, in as realistic a manner as possible, given the constraint of not
being able to add new features to the browser itself.

## Status

This project is just beginning. Don't expect anything to work yet!

## Design

FLEDGE requires a way to store information in the browser that is (a) accessible
across all websites but (b) only through JavaScript access control.
`localStorage` in a cross-origin iframe fits this well. In Chrome this is not
partitioned and only JavaScript running within the iframe can read or modify the
data.

The shim is divided into two pieces:

- A _frame_ that's embedded onto the page cross-origin in an `<iframe>` tag,
  e.g., `<iframe src="https://fledge-shim.example/v/1234">`.

- A _library_ that consumers use to communicate with the frame over
  `postMessage`.

Almost all of the work happens in the frame; the library is a small adapter
that translate the API from functions to messages.

## API

We're planning to implement the API as closely as possible to what is presented
in the spec, but some aspects necessarily differ due to the constraints of
running on publisher and advertiser pages, and implementing without browser
changes.

### On-Page API

To make the API available on a page consumers will compile the library into
their code. We're thinking of making it available as an NPM package, or people
can pull from github manually.

#### Initialization

The library needs to know how to load the frame on the page, and this needs to
happen before any library calls that communicate with the frame.

```javascript
fledgeShim.initialize("https://fledge-polyfill.example");
```

The initialization call takes the origin of the frame only. Versioning
parameters are added automatically.

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
var adFrame = document.createElement("iframe");
// set whatever attributes you like on adFrame, and then call:
fledgeShim.renderAd(adFrame, auctionWinnerUrl);
```

Because fencedframes don't exist yet, this will render the ad in an
ordinary iframe. The shim will not be realistic in testing the
security, privacy, performance, or other attributes of fencedframes,
since it won't use them at all.

The `auctionWinnerUrl` will be an opaque `urn:uuid:` token, randomly generated
in response to the `runAdAuction` call. It should only be redeemed from the
same page that called `runAdAuction`.

### Worklets

#### Buyer and Seller Logic

The spec allows buyers and sellers to provide custom JavaScript (`generate_bid`,
`score_ad`) which will have access to interest group information. That access is
compatible with the privacy model, because these worklets are heavily locked
down, have no network access, and operate as pure functions. We are not aware
of any secure way to execute arbitrary JavaScript while protecting information
from exfiltration. Initially, we are planning to require buyers and sellers to
check their logic into this repo. Later, we may be able to use Web Assembly or
something custom to avoid that requirement.

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
- `runAdAuction`
- `renderAd`

Bidding and auction logic will be hardcoded, something very simple.

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
  possible, you should not generally expect the performance characteristics of the
  shim to be realistic.

- K-Anonymity: We don't intend to implement any of the k-anonymity restrictions.
  Implementing these restrictions requires either peer-to-peer browser
  interactions or a trusted server. We may revisit this once Chrome announces how
  they intend to implement it.
