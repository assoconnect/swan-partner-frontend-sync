import path from "pathe";
import pc from "picocolors";
import { start } from "./app";
import { env } from "./env";
import { AccountCountry } from "./graphql/partner";
import fastProxy from "fast-proxy";
import { FastifyReply, FastifyRequest } from "fastify";
import { IncomingMessage, ServerResponse } from "node:http";

const keysPath = path.join(__dirname, "../keys");

const countryTranslations: Record<AccountCountry, string> = {
  DEU: "German",
  ESP: "Spanish",
  FRA: "French",
  NLD: "Dutch",
  ITA: "Italian",
};

const accountCountries = Object.keys(countryTranslations) as AccountCountry[];

const onboardingCountries = accountCountries
  .map(accountCountry => ({
    cca3: accountCountry,
    name: countryTranslations[accountCountry],
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

start({
  mode: env.NODE_ENV,
  httpsConfig: undefined,
}).then(
  ({ app, ports }) => {
    const listenPort = async (port: string) => {
      // Expose 8080 so that we don't need `sudo` to listen to the port
      // That's the port we expose when dockerized
      //const finalPort = port === "80" || port === "443" ? "8080" : port;
      const finalPort = "8080";

      const { proxy: laPosteAPIProxy } = fastProxy({
        base: `https://api.laposte.fr/controladresse/v2/`,
      });
      const laPosteHandler = (request: FastifyRequest, reply: FastifyReply) => {
        console.log("Hellllloooooo");
        try {
          return laPosteAPIProxy(
            request.raw as unknown as IncomingMessage,
            reply.raw as unknown as ServerResponse,
            '/adresse',
            {
              rewriteRequestHeaders: (req, header) => ({
                ...header,
                'X-Okapi-Key': 'Kxf2qSgrlqlM7b8DnX2MF48vc',
              }),
            },
          );
        } catch (error) {
          console.log("THIS IS THE ERROR", error);
          if (!reply.sent) {
            console.error('La Poste API proxy error:', error);
            reply.status(502).send({ error: 'Erreur lors de la communication avec l\'API La Poste' });
          }
        }
      };
      // Support de plusieurs méthodes HTTP
      app.get('/services/laposte/address-control/*', laPosteHandler);

      try {
        await app.listen({ port: Number(finalPort), host: "0.0.0.0" });
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    };

    ports.forEach(port => void listenPort(port));

    console.log(``);
    console.log(`${pc.magenta("swan-partner-frontend")}`);
    console.log(`${pc.white("---")}`);
    console.log(pc.green(`${env.NODE_ENV === "development" ? "dev server" : "server"} started`));
    console.log(``);
    console.log(`${pc.magenta("Banking")} -> ${env.BANKING_URL}`);
    console.log(`${pc.magenta("Onboarding Individual")}`);
    onboardingCountries.forEach(({ cca3, name }) => {
      console.log(
        `  ${pc.cyan(`${name} Account`)} -> ${
          env.ONBOARDING_URL
        }/onboarding/individual/start?accountCountry=${cca3}`,
      );
    });
    console.log(`${pc.magenta("Onboarding Company")}`);
    onboardingCountries.forEach(({ cca3, name }) => {
      console.log(
        `  ${pc.cyan(`${name} Account`)} -> ${
          env.ONBOARDING_URL
        }/onboarding/company/start?accountCountry=${cca3}`,
      );
    });
    console.log(`${pc.magenta("Payment")} -> ${env.PAYMENT_URL}`);
    console.log(`${pc.white("---")}`);
    console.log(``);
    console.log(``);
  },
  err => {
    console.error(err);
    process.exit(1);
  },
);
