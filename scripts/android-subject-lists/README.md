This regression drives the production subject-list service and error reporter
against Android's native SQLite storage, using the installed AsyncStorage
dependency's actual `ReactDatabaseSupplier` source. It also saves, generates and
reloads a Word Search session. JavaScript runs in Jest on the host; SQLite runs
inside the emulator. It does not drive the full app UI.

The fixture uses a dedicated database under `/data/local/tmp`, never the app's
database or account. It copies the supplier into the ignored build directory;
the generated logging and build-constant stubs replace only React logging and
the initial 6 MB constant. The test applies the capacity from
`android/gradle.properties` through the supplier's native `setMaximumSize` API,
which is also used when the dependency opens its database in the app.

Use an existing booted emulator, Android SDK platform 36, build tools, JDK 17,
and the project's installed dependencies:

```sh
node scripts/run-android-subject-list-checks.mjs --device emulator-5554
```

The runner compiles a small command-line Android program without building or
launching the full app, then runs the native integration test. It writes the
capacity, free disk space, cache volume, failures and captured error-report rows
under `output/android-native-storage`. Reports are captured locally rather than
inserted into production Supabase. The runner removes its server, port
forwarding, program and database afterward. It never creates or wipes devices.

To replay the original failure with the repaired source, override only the
database limit:

```sh
node scripts/run-android-subject-list-checks.mjs --device emulator-5554 --database-size-mb 6
```

That run must fail with `SQLITE_FULL`, despite free device space. The default
64 MB run must preserve a first empty list and save/reload a Word Search after
6 MB of other cached data, with no error reports. This native configuration
change requires a new Android app build; an OTA JavaScript update cannot change
the database size compiled into AsyncStorage.
