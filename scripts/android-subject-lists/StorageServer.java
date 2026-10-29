package com.reactnativecommunity.asyncstorage;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.pm.ApplicationInfo;
import android.database.Cursor;
import android.database.DatabaseErrorHandler;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import java.io.*;
import java.net.*;
import java.util.Arrays;
import org.json.JSONObject;

/** Runs the installed AsyncStorage dependency's database supplier in Android. */
public class StorageServer {
  private static ReactDatabaseSupplier supplier;
  private static boolean running = true;
  private static void set(String key, String value) {
    SQLiteDatabase db = supplier.get();
    SQLiteStatement statement = db.compileStatement("INSERT OR REPLACE INTO catalystLocalStorage VALUES (?, ?);");
    db.beginTransaction();
    RuntimeException failure = null;
    try {
      statement.clearBindings();
      statement.bindString(1, key);
      statement.bindString(2, value);
      statement.execute();
      db.setTransactionSuccessful();
    } catch (RuntimeException error) {
      failure = error;
    } finally {
      statement.close();
      try {db.endTransaction();}
      catch (RuntimeException error) {if (failure == null) failure = error;}
    }
    if (failure != null) throw failure;
  }
  private static JSONObject execute(JSONObject request) throws Exception {
    SQLiteDatabase db = supplier.get();
    JSONObject result = new JSONObject();
    switch (request.getString("operation")) {
      case "reset":
        db.delete("catalystLocalStorage", null, null);
        db.execSQL("VACUUM");
        supplier.setMaximumSize(request.getLong("capacityBytes"));
        result.put("capacityBytes", db.getMaximumSize());
        result.put("availableDiskBytes", new File(db.getPath()).getParentFile().getUsableSpace());
        break;
      case "get":
        try (Cursor cursor = db.query("catalystLocalStorage", new String[]{"value"}, "key = ?", new String[]{request.getString("key")}, null, null, null)) {
          result.put("value", cursor.moveToFirst() ? cursor.getString(0) : JSONObject.NULL);
        }
        break;
      case "set":
        set(request.getString("key"), request.getString("value"));
        break;
      case "remove":
        db.delete("catalystLocalStorage", "key = ?", new String[]{request.getString("key")});
        break;
      case "fill":
        int characters = 0;
        int writes = 0;
        for (int size : new int[]{128 * 1024, 4096, 32}) {
          char[] chars = new char[size]; Arrays.fill(chars, 'x');
          String value = new String(chars);
          while (characters + size <= 6 * 1024 * 1024) {
            try {set("probe-padding-" + writes, value); characters += size; writes++;}
            catch (Exception failure) {result.put("lastFailure", failure.getMessage()); break;}
          }
        }
        result.put("characters", characters);
        result.put("writes", writes);
        break;
      case "shutdown": running = false; break;
      default: throw new IllegalArgumentException("Unknown operation");
    }
    return result;
  }
  public static void main(String[] args) throws Exception {
    final File database = new File(args[0]);
    Context context = new ContextWrapper(null) {
      @Override public Context getApplicationContext() {return this;}
      @Override public ApplicationInfo getApplicationInfo() {
        ApplicationInfo info = new ApplicationInfo(); info.targetSdkVersion = 23; return info;
      }
      @Override public String getPackageName() {return "kakehashi.storage.probe";}
      @Override public File getDatabasePath(String name) {return database;}
      @Override public boolean deleteDatabase(String name) {return SQLiteDatabase.deleteDatabase(database);}
      @Override public SQLiteDatabase openOrCreateDatabase(String name, int mode, SQLiteDatabase.CursorFactory factory) {
        return SQLiteDatabase.openOrCreateDatabase(database, factory);
      }
      @Override public SQLiteDatabase openOrCreateDatabase(String name, int mode, SQLiteDatabase.CursorFactory factory, DatabaseErrorHandler handler) {
        return SQLiteDatabase.openOrCreateDatabase(database.getAbsolutePath(), factory, handler);
      }
    };
    supplier = ReactDatabaseSupplier.getInstance(context);
    supplier.get();
    try (ServerSocket server = new ServerSocket(Integer.parseInt(args[1]), 8, InetAddress.getByName("127.0.0.1"))) {
      System.out.println("ANDROID_STORAGE_READY");
      System.out.flush();
      while (running) {
        try (Socket socket = server.accept()) {
          BufferedReader input = new BufferedReader(new InputStreamReader(socket.getInputStream(), "UTF-8"));
          JSONObject result;
          try {result = execute(new JSONObject(input.readLine()));}
          catch (Exception failure) {result = new JSONObject().put("error", failure.getMessage());}
          PrintWriter output = new PrintWriter(new OutputStreamWriter(socket.getOutputStream(), "UTF-8"));
          output.println(result.toString()); output.flush();
        }
      }
    } finally {supplier.closeDatabase(); SQLiteDatabase.deleteDatabase(database);}
  }
}
