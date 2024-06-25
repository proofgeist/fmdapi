# Core Functions

The following methods are available for all adapters.

- `list` return all records from a given layout
- `find` perform a FileMaker find
- `get` return a single record by recordID
- `create` return a new record
- `update` modify a single record by recordID
- `delete` delete a single record by recordID

# Helper Functions

This package also includes some helper methods to make working with Data API responses a little easier:

- `findOne` return the first record from a find instead of an array. This method will error unless exactly 1 record is found.
- `findFirst` return the first record from a find instead of an array, but will not error if multiple records are found.
- `findAll` return all found records from a find, automatically handling pagination. Use caution with large datasets!
- `listAll` return all records from a given layout, automatically handling pagination. Use caution with large datasets!

# Adapter-Specific Functions

The first-party `FetchAdapter` and `OttoAdatper` both share the following additional methods from the `BaseFetchAdapter`:

- `executeScript` execute a FileMaker script directly
- `layoutMetadata` return metadata for a given layout
- `layouts` return a list of all layouts in the database (top-level layout key ignored)
- `scripts` return a list of all scripts in the database (top-level script key ignored)
- `globals` set global fields for the current session (top-level globals key ignored)

If you have your own proxy, you can write your own Custom Adapter that extends the BaseFetchAdapter to also implement these methods.

## Fetch Adapter

- `disconnect` forcibly logout of your FileMaker session

## Otto Adapter

No additional methods
