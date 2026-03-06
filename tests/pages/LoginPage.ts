import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Login page
 * Encapsulates all interactions with the login form
 */
export class LoginPage {
  readonly page: Page;

  // Locators using semantic selectors
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly githubLoginButton: Locator;
  readonly toggleAuthModeButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Use getByLabel for form inputs - accessible and resilient
    this.emailInput = page.getByLabel(/email|邮箱/i);
    this.passwordInput = page.getByLabel(/password|密码/i);

    // Use getByRole for buttons
    this.submitButton = page.getByRole('button', { name: /login|sign.*in|登录|提交/i }).filter({
      has: page.locator('button[type="submit"]'),
    });

    // GitHub login button
    this.githubLoginButton = page.getByRole('button', { name: /github/i });

    // Toggle between login and signup
    this.toggleAuthModeButton = page.locator('button').filter({ hasText: /sign.*up|register|注册|login|登录/i }).last();

    // Error and success messages
    this.errorMessage = page.locator('[class*="destructive"], [class*="error"], .text-red');
    this.successMessage = page.locator('[class*="green"], [class*="success"]');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill in email field
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill in password field
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  /**
   * Submit the login form
   */
  async submit() {
    // Use the actual submit button (button[type="submit"])
    await this.page.click('button[type="submit"]');
  }

  /**
   * Perform login with credentials
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Login and wait for redirect to documents page
   */
  async loginAndWaitForRedirect(email: string, password: string, options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 15000;

    await this.login(email, password);

    // Wait for redirect to documents page
    await this.page.waitForURL('**/documents', { timeout });

    // Verify we're on documents page
    await expect(this.page).toHaveURL(/documents/);
  }

  /**
   * Click GitHub login button
   */
  async loginWithGithub() {
    await this.githubLoginButton.click();
  }

  /**
   * Toggle between login and signup modes
   */
  async toggleAuthMode() {
    await this.toggleAuthModeButton.click();
  }

  /**
   * Check if error message is visible
   */
  async expectErrorMessage() {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Check if success message is visible
   */
  async expectSuccessMessage() {
    await expect(this.successMessage).toBeVisible();
  }

  /**
   * Wait for page to be ready (form visible)
   */
  async waitForReady() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
