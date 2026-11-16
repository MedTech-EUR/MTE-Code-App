# Config

This directory contains centralized configuration files and registries for the application. `sections.js` defines the modules available on the Home Hub and their visual styles; the CVS checker card has an `href` (`CVS_CHECK_URL`, from `moved-pages.js` in the project root) and opens ethicalmedtech.eu in a new tab instead of a section of the app, and `TREE_PAGE_TOOLS` lists sections, such as the event support checker, on the Decision Trees page. `routes.js` supplies the current Code chapters, Transparency publications, and decision trees to the pure parser in `utils/routeUtils.js`.

See [URL Routing Guide](../../ROUTING.md) before changing route-related identifiers or adding a navigable section.

For more details on how configuration is used, see the [Project Map](../../AGENTS.md#project-map).
