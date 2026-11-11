/** A link people can follow ("example.com/register", "https://…", "mailto:…"); typed words aren't one. */
// A web, mailto: or tel: link, or a bare host ("example.com/register"). Not
// other schemes: javascript: and data: links aren't for people to tap.
export const looksLikeLink = (v: string) =>
  !/\s/.test(v) &&
  (/^(https?|mailto|tel):/i.test(v) || (!/^[a-z][a-z0-9+-]*:/i.test(v) && v.includes(".")));
export const LINK_PROBLEM = "That doesn’t look like a link. Try something like example.com/register.";
