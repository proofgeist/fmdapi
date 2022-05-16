

<div style="display:flex;justify-content:center; align-items:center;">
   <img height="64px" src="logo-fm.png" style="margin-right:10px;" />
   <img height="50px" src="logo-ts.png" />   
</div>

# Claris FileMaker Data API Client for TypeScript

This package is designed to make working with the FileMaker Data API much easier. Here's just a few key features:
- [Otto](https://ottofms.com/) Data API proxy support
- A lightweight code bundle
- TypeScript support for easy auto-completion of your fields
- Automated type generation based on layout metadata

## Installation

```sh
npm install @proofgeist/fmdapi
# or
yarn add @proofgeist/fmdapi
```

## Usage
Add the following envnironment variables to your project's `.env` file:

```sh
OTTO_API_KEY=KEY_123456...789
FM_DATABASE=filename.fmp12
FM_SERVER=https://filemaker.example.com
```

Initialize the client with your FileMaker Server credentials:

```typescript
import { DataApi } from "@proofgeist/fmdapi";

const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
});
```
Then, use the client to query your FileMaker database. Availble methods:
- `list` return all records from a given layout
- `find` perform a FileMaker find
- `get` return a single record by recordID
- `create` return a new record
- `update` modify a single record by recordID
- `delete` delete a single record by recordID
- `metadata` return metadata for a given layout
- `disconnect` forcibly logout of your FileMaker session (available when not using Otto Data API proxy)

Basic Example:
```typescript
const result = await client.list({ layout: "Contacts" });
```
### Client Setup Options
| Option | Type | Description |
| ------ | ---- | ----------- |
| `auth` | `object` | Authentication object. Must contain either `apiKey` or `username` and `password` |
| `db` | `string` | FileMaker database name |
| `server` | `string` | FileMaker server URL (must include `https://`) |
| `layout` | `string` | *(optional)* If provided, will be the layout used for all methods if not otherwise specified |

## TypeScript Support
The basic client will return the generic FileMaker response object by default. You can also create a type for your exepcted response and get a fully typed response that includes your own fields.
```typescript
type TContact = {
    name: string;
    email: string;
    phone: string;
}
const result = await client.list<TContact>({ layout: "Contacts" });
```

## Automatic Type Generation
This package also includes a helper function that will automatically generate types for each of your layouts. Use this tool within a package script to easily keep your types updated with any schema changes in FileMaker during development. 🤯

The generated code uses the [`zod`](https://github.com/colinhacks/zod) library so that you can also implement runtime validation for all calls to the Data API.

The example below also assumes you have have the [`dotenv`](https://github.com/motdotla/dotenv) package installed in order to use the same environment variables that you defined in the node script.

```typescript
// sample node script
import DataApi from "@proofgeist/fmdapi";
import { generateSchemas } from "@proofgeist/fmdapi/codegen";

// load environment variables
import dotenv from "dotenv";
const result = dotenv.config({ path: "./.env.local" });
if (!process.env.OTTO_API_KEY) throw new Error("No API key");

// initialize client, like normal (only requires read-only access)
const client = DataApi({
  auth: { apiKey: process.env.OTTO_API_KEY },
  db: process.env.FM_DATABASE,
  server: process.env.FM_SERVER,
});

// run codegen, passing in schema for each layout that you want to generate types
generateSchemas({
    client,
    schemas: [{ layout: "customer_api", schemaName: "Customer" }],
});
```
Assuming you have a layout called `customer_api` containing `name` `phone` and `email` fields for a customer, the generated code will look like this:
```typescript
// schema/Customer.ts
import { z } from "zod";
export const ZCustomer = z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string(),
});
export type TCustomer = z.infer<typeof ZCustomer>;
```

#### `generateSchemas` options

| Option | Type | Default | Description |
| ---| --- | --- | --- |
| client | DataAPI Client object | *(required)* | Used for making the metadata API call to your server |
| schemas | `Schema[]` | *(required)* | An array of `Schema` objects to generate types for (see below) |
| path | `string` | `"./schema"` | Path to folder where generated files should be saved. |
| useZod | `boolean` | `true` | An array of `Schema` objects to generate types for |

#### `Schema` options
| Option | Type | Default | Description |
| ---| --- | --- | --- |
| layout | `string` | *(required)* | The FileMaker source layout name |
| schemaName | `string` | *(required)* | The label for your schema (will also be the name of the generated file) |
| valueLists | `strict` `allowEmpty` `ignore` | `ignore` | If `strict`, will add enum types based on the value list defined for the field. If `allowEmpty`, will append `""` to the value list. Otherwise, fields are typed as normal. |

## FAQ

### This sounds too good to be true. What's the catch?
No catch! Really! But keep in mind this is a v1 release and we hope to imporve it in the future to support more use cases! Feel free to create an issue or pull request if you have any questions or suggestions.

### I don't like the way the code is generated. Can I edit the generated files?
They are just files added to your project, so you technically can, but we don't recommend it, as it would undermine the main benefit of being able to re-run the script at a later date when the schema changes—all your edits would be overritten. If you need to extend the types, it's better to do extend them into a new type/zod schema in another file. Or, if you have suggesstions for the underlying engine, Pull Requests are welcome!

### Do I have to install `dotenv` or `zod` for this package to work?
No. Those packages are only required if you want to use the automatic type generation feature. The pure DataAPI client installs all its neccesary dependencies automatically. If you want to generate types directly instead of Zod objects, set the `useZod` flag to `false` in the `generateSchemas` function.

### Why are number fields typed as a `string | number`?
FileMaker will return numbers as strings if the field is empty. This ensures you properly account for this in your frontend code.

### How does the code generation handle Value Lists?
Values lists are exported as their own types within the schema file, but they are not enforced within the schema by default because the actual data in the field may not be fully validated.

If you want the type to be enforced to a value from the value list, you can enable the `strictValueLists` flag per schema in your definition. This feature is only reccommended when you're also using the Zod library, as your returned data will fail the validation if the value is not in the value list.

### What about date/time/timestamp fields?
For now, these are all typed as strings. You probably want to transform these values anyway, so we keep it simple at the automated level.

### Can I run the `generateSchemas` function in a CI/CD environment?
Yes, great idea! This could be a great way to catch errors that would arise from any changes to the FileMaker schema. 

### Why Zod instead of just TypeScript?
**In short:** Zod is a TypeScript-first schema declaration and validation library. When you use it, you get *runtime* validation of your data instead of just compile-time validation.

FileMaker is great for being able to change schema very quickly and easily. Yes, you probably have naming conventions in place that help protect against these changes in your web apps, but no system is perfect. Zod lets you start with the assumption that any data coming from an external API might be in a format that you don't expect and then valdiates it so that you can catch errors early. This allows the typed object that it returns to you to be much more trusted throughout your app.

**But wait, does this mean that I might get a fatal error in my production app if the FileMaker schema changes?** Yes, yes it does. This is actually what you'd want to happen. Without validating the data returned from an API, it's possible to get other unexpcted side-effects in your app that don't present as errors, which may lead to bugs that are hard to track down or inconsistencies in your data.