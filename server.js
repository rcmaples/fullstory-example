const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const cors = require('cors');

const schema = buildSchema(`
  type Query {
    ping: String
  }
`);

const root = {
  ping: () => `pong @ ${new Date().toISOString()}`
};

const app = express();
app.use(cors())
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

app.listen(4000);

console.log('Running a GraphQL API server at http://localhost:4000/graphql');