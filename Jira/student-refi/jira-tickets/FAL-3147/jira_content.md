# FAL-3147 - [BE] Organize co-mingled responses from all sources

Status: PROD-Deployable
Reporter: Emily Allman Gump
Assignee: Pradip Jare
Labels: 

## Description

The purpose of this story is to describe the approach ALP will take when organizing the “best” product offers from all pricing/eligibility sources. For the sake of this story, we are considering two PE sources (Figure + DESK), and 3 total product options.

Background:

When Offers are returned from DESK/OB for the HELOAN product, and Figure for the HELOC(s)

the offers need to be sorted, organized, and qualified to ensure that the “best” offer is what the LO is positioned to sell to the consumer.

For the purpose of this story, we are considering Best to be defined as: the lowest rate at the requested loan amount.

- If the borrower is ineligible for the requested loan amount, we will show the lowest rate at the max they do qualify for.



Additionally we need data points from the offers to be displayed on the FE FAL-3148, so that the LO can best understand the structure of the offer and the borrower’s broader qualifications.

 

Data point

Source

FE format

DESK response

Figure response

Product name (static: HELOAN, Fixed rate HELOC, Variable rate HELOC)

static data point / matching on the Figure product

HELOAN

Fixed Rate HELOC

Variable Rate HELOC

N/A

"underwriting": {

"offers": [

"rateType": "FIXED" or "VARIABLE"

Rate

PE sources

singular (lowest)rate for each product where the loan amount = request value, or the next highest amount: HELOAN

Fixed Rate HELOC

Variable Rate HELOC

"products": [

 

 

"rate": 0,

"underwriting": {

"offers": [

{

"rate": 0.0915,

Badge

static data point

HELOAN = Lowest rateFixed = fast, consistent paymentsVariable = fast, flexible

N/A

N/A

Loan Amount

Static Requested amount,or the max if the max is less than the requested amount

DESK / Figure

$xxx,xxxx

],      "eligibilityCriteria": [},          "totalLoanAmount": {"max": 0

],        "decision": "INITIAL","maxOfferAmount":

Term

Desk / Figure

xx years

"products": [ "loanTerm": "30 Yr",

 "offers": ["term": xx,

Offer details header

Estimated closing costs

Static calc’d range / Figure calc’d

HELOAN = $xx,xxxx ⎯ $YY,YYY 

1550 + (loan_amount*.05%) = $xx,xxx

⎯ 2750 + loan amount x .05% =$YY,YYY



Fixed = $xx,xxx

Variable =  $xx,xxx

N/A

SUM ("data": {    "appData": {      "costs": {        "fixedCosts": [

"totalPaidByBorrower": 125,

Loan amount x "originationFeePercent" x.xxxx= $xx,xxxx

Credit Score required

Static data point

HELOAN =if occupancy = primary, min = 660if occupancy = second, max = 660if occupancy = investment, max = 680



Fixed= 600Variable= 600

N/A

N/A

Early payoff penalty

Static data point

HELOAN = Investor specificFixed = NoneVariable = None

N/A

N/A

Processing time

Static data point

HELOAN = 10 - 14 daysFixed = 1 - 5 daysVariable = 1 - 5 days

N/A

N/A

Max LTV

Static data point

HELOAN =if occupancy = primary, max = 90%if occupancy = second, max = 85%if occupancy = investment, max = 75%



Fixed = 85%Variable = 85%

N/A

N/A

Rate Type

Static data point

HELOAN = FixedFixed = Fixed at each drawVariable = Variable

N/A

N/A
