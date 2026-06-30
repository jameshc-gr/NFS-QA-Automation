export abstract class BasePage {
  protected byText(text: string): any {
    return $(`//android.widget.TextView[@text=${JSON.stringify(text)}]/..`);
  }

  protected byInputLabel(label: string): any {
    return $(`//android.widget.EditText[.//android.widget.TextView[@text=${JSON.stringify(label)}]]`);
  }

  protected async waitForVisible(selector: string | any) {
    const element: any = typeof selector === 'string' ? $(selector) : selector;
    await element.waitForDisplayed({ timeout: 15000 });
    return element;
  }

  protected async tap(selector: string | any): Promise<void> {
    const element = await this.waitForVisible(selector);
    const location = await element.getLocation();
    const size = await element.getSize();

    try {
      await browser.execute('mobile: clickGesture', {
        x: Math.round(location.x + size.width / 2),
        y: Math.round(location.y + size.height / 2)
      });
      return;
    } catch {
      await element.click();
    }
  }

  protected async type(selector: string | any, value: string): Promise<void> {
    const element = await this.waitForVisible(selector);
    await element.clearValue();
    await element.setValue(value);
  }
}