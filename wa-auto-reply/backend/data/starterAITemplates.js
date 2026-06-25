const welcomeAITemplate = require('./exampleAITemplate');
const internshipAITemplate = require('./internshipAITemplate');

const starterAITemplates = [welcomeAITemplate, internshipAITemplate];

const starterBySlug = Object.fromEntries(
  starterAITemplates.map((template) => [template.slug || template.name, template])
);

module.exports = {
  starterAITemplates,
  starterBySlug
};
