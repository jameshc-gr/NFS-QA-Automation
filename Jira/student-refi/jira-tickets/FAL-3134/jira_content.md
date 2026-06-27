# FAL-3134 - [FE] Adjust existing LO inquiry form

Status: PROD-Deployable
Reporter: Emily Allman Gump
Assignee: Gajesh Panigrahi
Labels: 

## Description

The purpose of this story is to outline the front end modifications that are required for the LO inquiry form.The form will be reorganized and have a few design/content adjustments to make it more user friendly and applicable to additional loan products.

Updated Components (8)

- Greeting - Change copy to: Hi, (LO first name)!


- Header - Change copy to: Home Equity Product Search


- Introduce an inline alert (blue) - (search icon) Prequalify your client and explore eligible scenarios.


- Change form order: Move property information to the top of the form, and Loan information to below property information


- Add a data field to Property information Existing mortgage amount

- data point is required


- format to be $xxx,xxx,xxx


- placement to be below the subject property address but above “This home is for sale”




- Default the “Does the borrower live at this address” check box to Checked


- Occupancy to default to “Primary”

- If primary is selected, the checkbox will remain checked and a new address cannot be added


- if they uncheck the box, primary is not selectable




- Borrower Information - No changes


- Income information - No changes


- Consent - No changes


- CTA - copy to change from “next” to “Submit”

- When I click submit the backend will not call the open Liens API  


- I will not Nav to the Lien Confirmation form, but will Nav to the Processing form.  





DESIGN:
