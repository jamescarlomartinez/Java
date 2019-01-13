package com.company;

import java.util.*;

public class Main {

    public static void main(String[] args) {

        int container = 30;
        String header = "\n";
        content = "";
        String footer = "";
        System.out.println("     |      __________________________      |");
        System.out.println("     |     |Hi! My name is james!   |     |");
        System.out.println("     |     |Welcome to my restaurant! |     |");
        System.out.println("     |     |__________________________|     |");
        System.out.println("     |                   ^                  |");
        System.out.println("     |      __________________________      |");
        System.out.println("     |     |Would you like to order?  |     |");
        System.out.println("     |     |     Y-> YES N-> NO       |     |");
        System.out.println("     |     |__________________________|     |");
        System.out.println("     |                   ^                  |");
        System.out.println("     |                   |                  |");
        System.out.println("     |            _____________             |");
        System.out.println("     |            |           |             |");
        System.out.println("     |           *|   0   0   |*  '''       |");
        System.out.println("     |          * |  *  ^   * | * *         |");
        System.out.println("     |         *  |   *---*   |  *          |");
        System.out.println("     |        *   |___________|             |");
        System.out.println("     |      '''       |   |                 |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |              ==*   *==               |");
        System.out.println();

        println(header + content + footer);

        String willOrder = sc.next();
        while (!willOrder(willOrder)) {
            willOrder = sc.next();
        }


        if (willOrder.equals("Y") || willOrder.equals("y")) {
            content = "||      What is your name?      ||\n"; //18 char --> 30-18=12/=6
            println(header + content + footer);
            //DETECTS NAME INPUT
            name1 = sc.next();

            int space = container - name1.length();
            double leftSpace = 0;
            double rightSpace = 0;
            String callMe = "||";
            if (isEven(space + 1)) {

                leftSpace = space / 2;
                rightSpace = space / 2;
            } else {

                leftSpace = space / 2;
                rightSpace = (space / 2) - 1;
            }

            for (int i = 0; i < leftSpace; i++) {
                callMe += " ";
            }

            String name = Character.toUpperCase(name1.charAt(0)) + "";
            for (int i = 1; i < name1.length(); i++) {
                name += name1.charAt(i);
            }

            callMe += name + "!";
            for (int i = 0; i < rightSpace; i++) {
                callMe += " ";
            }

            callMe += "||\n";
            mainMenu(header, callMe, footer);
        } else {

            endP(header, "", footer, false);
        }
    }


    public static void print(String p) {
        System.out.print(p);
    }

    public static void println(String p) {
        System.out.println(p);
    }

    public static Scanner sc = new Scanner(System.in);
    public static String content = "";
    public static int cost = 0; //DIVIDE BY 100 AFTER
    public static String name1 = "";
    public static int[][] orders = new int[4][6];
    public static boolean[] hasOrder = new boolean[4];
    public static int receipt = 0;

    public static void mainMenu(String h, String c, String f) {
        content = "||  What would you like today?  ||\n"; //What would you like today? == 26
        content += "||\t\t\t\t||\n";
        content += "||         A. Breakfast         ||\n"; //30-12 = 18
        content += "||         B. Heavy Meal        ||\n";
        content += "||         C. Snacks            ||\n";
        content += "||         D. Desserts          ||\n";
        f = "||       X - Cancel Order       ||\n";
        f += "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        String category = "";
        while (!isInCategory(category)) {
            category = sc.next();
        }
        ;
        switch (category) {

            case "a":
            case "A":
                breakfast(h, c, f);
                break;


            case "b":
            case "B":
                heavy_meal(h, c, f);
                break;


            case "c":
            case "C":
                snacks(h, c, f);
                break;


            case "d":
            case "D":
                desserts(h, c, f);
                break;


            case "x":
            case "X":
                endP(h, c, f, true);
                break;


            case "z":
            case "Z":
                for (int i = 0; i < 5; i++) {
                    println("");
                }
                if (name1.equals("satch") || name1.equals("Satch") || name1.equals("satchi") || name1.equals("Satchi"))
                    println("Created by you!");
                else
                    println("Created by DV Restaurant");
                for (int i = 0; i < 5; i++) {
                    println("");
                }
                mainMenu(h, c, f);
                break;
        }
    }


    public static void breakfast(String h, String c, String f) {
        content = "||\t\t\t\t||\n";
        content += "||        -------------         ||\n";
        content += "||        ||BREAKFAST||         ||\n";
        content += "||        -------------         ||\n";
        content += "|| Here's our menu for the day: ||\n";
        content += "||  A.Hotsilog           $1.00  ||\n";
        content += "||  B.Tocilog            $1.00  ||\n";
        content += "||  C.Hamdesal           $0.75  ||\n";
        content += "||  D.Pancake            $0.90  ||\n";
        content += "||  E.Bacon with Rice    $1.25  ||\n";
        content += "||  F.Coffee             $0.50  ||\n";
        content += "||\t\t\t\t||\n";
        content += "||  X - Go Back                 ||\n";
        f = "||       Z - Cancel Order       ||\n";
        f += "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        String menu = sc.next();
        while (!isInMenu.breakfast(menu)) {
            menu = sc.nextLine();
        }

        switch (menu) {
            case "a":
            case "A":
                cost += 100;
                orders[0][0]++;
                hasOrder[0] = true;
                receipt += 100;
                break;

            case "b":
            case "B":
                cost += 100;
                orders[0][1]++;
                hasOrder[0] = true;
                receipt += 100;
                break;

            case "c":
            case "C":
                cost += 75;
                orders[0][2]++;
                hasOrder[0] = true;
                receipt += 75;
                break;

            case "d":
            case "D":
                cost += 90;
                orders[0][3]++;
                hasOrder[0] = true;
                receipt += 90;
                break;

            case "e":
            case "E":
                cost += 125;
                orders[0][4]++;
                hasOrder[0] = true;
                receipt += 125;
                break;

            case "f":
            case "F":
                cost += 50;
                orders[0][5]++;
                hasOrder[0] = true;
                receipt += 100;
                break;

            case "x":
            case "X":
                mainMenu(h, c, f);
                break;

            case "z":
            case "Z":
                endP(h, c, f, true);
                break;
        }

        String rec = String.format("%.2f", (double) receipt / 100) + "";
        content = "||\t\t\t\t||\n";
        if (rec.length() == 4)
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "         ||\n";
        else
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "        ||\n";
        content += "||        -------------         ||\n";
        content += "||        ||THANK YOU||         ||\n";
        content += "||        -------------         ||\n";
        content += "|| Would you like to add more?  ||\n";
        content += "||\tY - Yes     N - No\t        ||\n";
        println(h + c + content + f);
        String willOrder = sc.next();
        while (!willOrder(willOrder)) {
            willOrder = sc.next();
        }

        switch (willOrder) {
            case "Y":
            case "y":
                mainMenu(h, c, f);
                break;

            case "N":
            case "n":
                isDiscEl(h, c, f);
                break;

            case "Z":
            case "z":
                endP(h, c, f, true);
                break;
        }

    }


    public static void heavy_meal(String h, String c, String f) {
        //SA NAGEDIT NG MENU A NITONG LUNCH, MAMATAY KA NA! -_-
        content = "||\t\t\t\t||\n";
        content += "||        --------------        ||\n";
        content += "||        ||HEAVY-MEAL||        ||\n";
        content += "||        --------------        ||\n";
        content += "|| Here's our menu for the day: ||\n";
        content += "|| A.Fish Pilaey         $1.50  ||\n";
        content += "|| B.Fried Manok         $1.00  ||\n";
        content += "|| C.Tokwang Tofu        $0.75  ||\n";
        content += "|| D.Mundo ng Menudo     $0.90  ||\n";
        content += "|| E.Adobong Nakaka Bobo $1.25  ||\n";
        content += "|| F.Drink               $0.25  ||\n";
        content += "||\t\t\t\t||\n";
        content += "|| X - Go Back                  ||\n";
        f = "||       Z - Cancel Order       ||\n";
        f += "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        String menu = sc.next();
        while (!isInMenu.heavy_meal(menu)) {
            menu = sc.nextLine();
        }

        switch (menu) {
            case "a":
            case "A":
                orders[1][0]++;
                cost += 150;
                hasOrder[1] = true;
                receipt += 150;
                break;

            case "b":
            case "B":
                cost += 100;
                orders[1][1]++;
                hasOrder[1] = true;
                receipt += 150;
                break;

            case "c":
            case "C":
                cost += 75;
                orders[1][2]++;
                hasOrder[1] = true;
                receipt += 75;
                break;

            case "d":
            case "D":
                cost += 90;
                orders[1][3]++;
                hasOrder[1] = true;
                receipt += 90;
                break;

            case "e":
            case "E":
                cost += 125;
                orders[1][4]++;
                hasOrder[1] = true;
                receipt += 125;
                break;

            case "f":
            case "F":
                cost += 25;
                orders[1][5]++;
                hasOrder[1] = true;
                receipt += 25;
                break;

            case "x":
            case "X":
                mainMenu(h, c, f);
                break;

            case "z":
            case "Z":
                endP(h, c, f, true);
                break;
        }
        String rec = String.format("%.2f", (double) receipt / 100) + "";
        content = "||\t\t\t\t||\n";
        if (rec.length() == 4)
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "         ||\n";
        else
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "        ||\n";
        content += "||        -------------         ||\n";
        content += "||        ||THANK YOU||         ||\n";
        content += "||        -------------         ||\n";
        content += "|| Would you like to add more?  ||\n";
        content += "||\tY - Yes     N - No\t||\n";
        println(h + c + content + f);
        String willOrder = sc.next();
        while (!willOrder(willOrder)) {
            willOrder = sc.next();
        }
        //ASK IF WILL ORDER AGAIN
        switch (willOrder) {
            case "Y":
            case "y":
                mainMenu(h, c, f);
                break;

            case "N":
            case "n":
                isDiscEl(h, c, f);
                break;

            case "Z":
            case "z":
                endP(h, c, f, true);
                break;
        }
    }

    //SNACKS
    public static void snacks(String h, String c, String f) {
        content = "||\t\t\t\t||\n";
        content += "||          ----------          ||\n";
        content += "||          ||SNACKS||          ||\n";
        content += "||          ----------          ||\n";
        content += "|| Here's our menu for the day: ||\n";
        content += "|| A.Clubhouse Sandwich  $0.95  ||\n";
        content += "|| B.Ay, Scream Sandwich $1.00  ||\n";
        content += "|| C.Flat Earthed Potato $1.10  ||\n";
        content += "|| D.Oi Siomai!(4 pcs.)  $0.75  ||\n";
        content += "|| E.Prinitong Noodles   $0.85  ||\n";
        content += "|| F.Softdrinks          $0.30  ||\n";
        content += "||\t\t\t\t||\n";
        content += "|| X - Go Back                  ||\n";
        f = "||       Z - Cancel Order       ||\n";
        f += "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        String menu = sc.next();
        while (!isInMenu.snacks(menu)) {
            menu = sc.nextLine();
        }
        //SUB-MENU CHOICES
        switch (menu) {
            case "a":
            case "A":
                cost += 95;
                orders[2][0]++;
                hasOrder[2] = true;
                receipt += 95;
                break;

            case "b":
            case "B":
                cost += 100;
                orders[2][1]++;
                hasOrder[2] = true;
                receipt += 100;
                break;

            case "c":
            case "C":
                cost += 110;
                orders[2][2]++;
                hasOrder[2] = true;
                receipt += 110;
                break;

            case "d":
            case "D":
                cost += 75;
                orders[2][3]++;
                hasOrder[2] = true;
                receipt += 75;
                break;

            case "e":
            case "E":
                cost += 85;
                orders[2][4]++;
                hasOrder[2] = true;
                receipt += 85;
                break;

            case "f":
            case "F":
                cost += 30;
                orders[2][5]++;
                hasOrder[2] = true;
                receipt += 30;
                break;

            case "x":
            case "X":
                mainMenu(h, c, f);
                break;

            case "z":
            case "Z":
                endP(h, c, f, true);
                break;
        }
        String rec = String.format("%.2f", (double) receipt / 100) + "";
        content = "||\t\t\t\t||\n";
        if (rec.length() == 4)
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "         ||\n";
        else
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "        ||\n";
        content += "||        -------------         ||\n";
        content += "||        ||THANK YOU||         ||\n";
        content += "||        -------------         ||\n";
        content += "|| Would you like to add more?  ||\n";
        content += "||\tY - Yes     N - No\t||\n";
        println(h + c + content + f);
        String willOrder = sc.next();
        while (!willOrder(willOrder)) {
            willOrder = sc.next();
        }
        //ASK IF WILL ORDER AGAIN
        switch (willOrder) {
            case "Y":
            case "y":
                mainMenu(h, c, f);
                break;

            case "N":
            case "n":
                isDiscEl(h, c, f);
                break;

            case "Z":
            case "z":
                endP(h, c, f, true);
                break;
        }
    }

    //DESSERTS
    public static void desserts(String h, String c, String f) {
        content = "||\t\t\t\t||\n";
        content += "||         ------------         ||\n";
        content += "||         ||DESSERTS||         ||\n";
        content += "||         ------------         ||\n";
        content += "|| Here's our menu for the day: ||\n";
        content += "|| A.Banana Split        $1.25  ||\n";
        content += "|| B.Cake Slice          $1.00  ||\n";
        content += "|| C.Wiggly Jelly        $0.45  ||\n";
        content += "|| D.Nakaka Lecheng Flan $1.35  ||\n";
        content += "|| E.PACKG Salad         $1.70  ||\n";
        content += "|| F.Smoothie/Shake      $0.50  ||\n";
        content += "||\t\t\t\t||\n";
        content += "|| X - Go Back                  ||\n";
        f = "||       Z - Cancel Order       ||\n";
        f += "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        String menu = sc.next();
        while (!isInMenu.desserts(menu)) {
            menu = sc.nextLine();
        }
        //SUB-MENU CHOICES
        switch (menu) {
            case "a":
            case "A":
                cost += 125;
                orders[3][0]++;
                hasOrder[3] = true;
                receipt += 125;
                break;

            case "b":
            case "B":
                cost += 100;
                orders[3][1]++;
                hasOrder[3] = true;
                receipt += 100;
                break;

            case "c":
            case "C":
                cost += 45;
                orders[3][2]++;
                hasOrder[3] = true;
                receipt += 45;
                break;

            case "d":
            case "D":
                cost += 135;
                orders[3][3]++;
                hasOrder[3] = true;
                receipt += 135;
                break;

            case "e":
            case "E":
                cost += 170; //PACKG = P-ineapple, A-pple, C-ream , K-iwi, G-rapes;
                orders[3][4]++;
                hasOrder[3] = true;
                receipt += 170;
                break;

            case "f":
            case "F":
                cost += 50;
                orders[3][5]++;
                hasOrder[3] = true;
                receipt += 50;
                break;

            case "x":
            case "X":
                mainMenu(h, c, f);
                break;

            case "z":
            case "Z":
                endP(h, c, f, true);
                break;
        }
        String rec = String.format("%.2f", (double) receipt / 100) + "";
        content = "||\t\t\t\t||\n";
        if (rec.length() == 4)
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "         ||\n";
        else
            content += "||         Total: $" + String.format("%.2f", ((double) receipt / 100)) + "        ||\n";
        content += "||        -------------         ||\n";
        content += "||        ||THANK YOU||         ||\n";
        content += "||        -------------         ||\n";
        content += "|| Would you like to add more?  ||\n";
        content += "||\tY - Yes     N - No\t||\n";
        println(h + c + content + f);
        String willOrder = sc.next();
        while (!willOrder(willOrder) || (willOrder.equals("z") || willOrder.equals("Z"))) {
            willOrder = sc.next();
        }
        //ASK IF WILL ORDER AGAIN
        switch (willOrder) {
            case "Y":
            case "y":
                mainMenu(h, c, f);
                break;

            case "N":
            case "n":
                isDiscEl(h, c, f);
                break;

            case "Z":
            case "z":
                endP(h, c, f, true);
                break;
        }
    }

    //KNOWING IF ELIGIBLE FOR DISCOUNT
    public static void isDiscEl(String h, String c, String f) {
        boolean senior = false;
        boolean student = false;
        boolean pwd = false;
        boolean isDiscElig = false;
        content = "||\t\t\t\t||\n";
        content += "||    Please enter your age:    ||\n";
        f = "||\t\t\t\t||\n";
        f += "O================================O";
        println(h + c + content + f);
        //VAR INITIALIZATION
        int age = sc.nextInt();
        content = "||\t\t\t\t||\n";
        content += "||        Are you a PWD?        ||\n";
        content += "||       Y - YES  N - NO        ||\n";
        println(h + c + content + f);
        String isPWD = sc.next();
        //IS THE CUSTOMER STUDENT?
        if (age <= 22)
            student = true;
        //IS THE CUSTOMER PWD?
        if (isPWD.equals("Y") || isPWD.equals("y"))
            pwd = true;
        //IS THE CUSTOMER SENIOR?
        if (age >= 60)
            senior = true;
        //DECIDES OF THE DISCOUNT IS ELIGIBLE
        if (pwd || senior || student)
            isDiscElig = true;
        realIsDiscElig = isDiscElig;
        payment(h, c, f, isDiscElig);
    }

    //RECEIVING PAYMENT
    public static boolean realIsDiscElig = false;

    public static void payment(String h, String c, String f, boolean isDiscElig) {
        //VARIABLE INITIALIZATION
        String changes = "";
        String rec = "";
        String costs = "";
        String receiveds = "";
        boolean willPay = false;
        double costd = (double) cost / 100;

        ///////////////////////////
        ///AVAILING THE DISCOUNT///
        ///////////////////////////
        if (isDiscElig)
            costd = ((double) cost * 0.8) / 100; //cost*0.8 == cost-20%; costd = cost/100

        //////////////////////////////////
        ///PRINT THE AMOUNT TO BE PAYED///
        //////////////////////////////////
        content = "||\t\t\t\t||\n";
        if (String.format("%.2f", costd).length() > 4)
            content += "||         Total: $" + String.format("%.2f", costd) + "        ||\n";
        else
            content += "||         Total: $" + String.format("%.2f", costd) + "         ||\n";
        content += "|| Please pay the said amount,  ||\n";
        content += "||          Thank you!          ||\n";
        content += "||   How much is your payment?  ||\n";
        println(h + c + content + f);
        print("$");
        double received = sc.nextDouble();
        double lastInp = received;

        //FOR ACCURACY...
        double change = 0;
        //CONVERTING TO INTEGER...
        received *= 100;
        received = Math.floor(received);
        //CALCULCULATING RECEIVED AND COSTS DIFFERENCE...
        int ichange = Math.abs((int) received - (int) (costd * 100));
        //CONVERSION TO DOUBLE
        /*String.format("%.2f",*/
        change/*);*/ = Math.abs((double) ichange / 100);

        //////////////////////
        ///RECEIVED MESSAGE///
        //////////////////////
        if (((received / 100) * 100) < lastInp)
            received = lastInp - ((received / 100) * 100);
        try {
            receiveds = (received / 100) + "";
            char receivedc = receiveds.charAt(3);
            println("> Received $" + String.format("%.2f", (received / 100)) + ".");
        } catch (Exception e) {
            receiveds = String.format("%.2f", (received / 100));
            println("> Received $" + receiveds + ".");
        }
        content = "||\t\t\t\t||\n";
        String oList = "";

        //////////////////////
        ///GIVE CHANGE BACK///
        //////////////////////
        if ((lastInp > costd) && (change > 0)) {
            content += "||          Thank you!          ||\n";
            content += "||       Have a nice day!       ||\n";
            double tnd = (Math.random() * 1000000000);
            double tndd = (Math.random() * 1000000000);
            String tns = (int) tnd + "";
            String tnss = (int) tndd + "";
            if (tns.length() < 10) {
                for (int i = 0; i <= (10 - tns.length()); i++) {
                    tns += "0";
                    tnss += "0";
                }
            }
            if (tnss.length() < 10) {
                for (int i = 0; i <= (10 - tnss.length()); i++) {
                    tnss += "0";
                }
            }
            ////////////////////////////////
            ///PRINTING THE ORDER RECEIPT///
            ////////////////////////////////
            int top = 0;
            String[][] orderName = {
                    {"Hotsilog", "Tocilog", "Hamdesal", "Pancake", "Bacon with Rice", "Coffee"},
                    {"Fish Pilaey", "Fried Manok", "Tokwang Tofu", "Mundo ng Menudo", "Adobong Nakaka Bobo", "Drink"},
                    {"Clubhouse Sandwich", "Ay, Scream Sandwich", "Flat Earthed Potato", "Oi Siomai", "Prinitong Noodles", "Soft drinks"},
                    {"Banana Split", "Cake Slice", "Wiggly Jelly", "Nakaka Lecheng Flan", "PACKG Salad", "Smoothie/Shake"},
            };
            int[][] orderNameLength = {
                    {7, 6, 7, 6, 14, 5},//Breakfast name length
                    {10, 10, 11, 14, 18, 4},//Heavy Meal name length
                    {17, 18, 18, 8, 16, 10},//Snacks name length
                    {11, 9, 11, 18, 10, 13}//Desserts name length
            };
            int[][] orderPrices = {
                    {100, 100, 75, 90, 125, 50},
                    {150, 100, 75, 90, 125, 25},
                    {95, 100, 110, 75, 85, 30},
                    {125, 100, 45, 135, 170, 50}
            };
            oList += "|| ____________________________ ||\n";
            oList += "|| - - - - D I N E  I N - - - - ||\n";
            for (int i = 0; i < hasOrder.length; i++) {
                if (hasOrder[i]) {
                    for (int j = 0; j < orders[i].length; j++) {
                        if (orders[i][j] > 0) {
                            //THE SPACE LEFT
                            oList += "|| ";
                            int space = 0;
                            if ((orders[i][j] > 9) && ((double) (orderPrices[i][j] * orders[i][j]) / 100) >= 10) {
                                space = 28 - (orderNameLength[i][j] + 12);
                            } else if ((orders[i][j] > 9) && (((double) (orderPrices[i][j] * orders[i][j]) / 100) < 10) || ((orders[i][j] < 10) && ((double) (orderPrices[i][j] * orders[i][j]) / 100) > 9)) {
                                space = 28 - (orderNameLength[i][j] + 11);
                            } else {
                                space = 28 - (orderNameLength[i][j] + 10);
                            }
                            //SET SOME STUFF
                            oList += orderName[i][j] + "(x" + orders[i][j] + ")";
                            //SETTING SPACE BETWEEN
                            for (int k = 1; k <= space; k++)
                                oList += " ";
                            //SETS THE CONTENT
                            double op = (((double) orderPrices[i][j] * orders[i][j]) / 100);
                            oList += "$" + String.format("%.2f", op);
                            oList += " ||\n";

                            //ADDS THE PRICE SO THAT I CAN ACCURATELY GIVE THE RECEIPT
                            for (int k = 0; k < orders[i][j]; k++)
                                top += orderPrices[i][j];
                        }
                    }
                }
            }
            oList += "||                              ||\n";
            if (realIsDiscElig) {
                if ((top / 100) < 10)
                    oList += "|| TOTAL:                 $" + String.format("%.2f", (((double) top / 100))) + " ||\n";
                else
                    oList += "|| TOTAL:                $" + String.format("%.2f", (((double) top / 100))) + " ||\n";
            } else {
                if (((top / 100) * .8) < 10)
                    oList += "|| TOTAL:                 $" + String.format("%.2f", ((double) top / 100)) + " ||\n";
                else
                    oList += "|| TOTAL:                $" + String.format("%.2f", ((double) top / 100)) + " ||\n";
            }

            if (realIsDiscElig) {
                oList += "|| ---------------------------- ||\n";
                oList += "|| Senior/Student/PWD           ||\n";
                oList += "|| discount:              $" + String.format("%.2f", (((double) top / 100) * 0.2)) + " ||\n";
                if ((top / 100) < 10)
                    oList += "|| TOTAL w/ discount:     $" + String.format("%.2f", (((double) top / 100) * .8)) + " ||\n";
                else
                    oList += "|| TOTAL w/ discount:    $" + String.format("%.2f", (((double) top / 100) * .8)) + " ||\n";
            }
            String changeS = String.format("%.2f", change) + "";
            int changeSpace = 20;
            oList += "|| ---------------------------- ||\n";
            oList += "|| CHANGE:";
            for (int i = 0; i < (changeSpace - changeS.length()); i++) {
                oList += " ";
            }
            oList += "$" + changeS + " ||\n";
            willPay = false;
            //SETS THE STRING REC VAR (LEGAL AND OFFICIAL LIKE A RECEIPT)///
            rec = "|| ---------------------------- ||\n";
            rec += "||  Transaction no. " + tns + "  ||\n"; //Transaction no. == 16
            //rec+="|| ---------------------------- ||\n";
            rec += "||      This serves as an       ||\n";
            rec += "||       OFFICIAL RECEIPT       ||\n";
            rec += "|| ACCREDITATION NO. " + tnss + " ||\n";
            rec += "||  THIS INVOICE/RECEIPT SHALL  ||\n";
            rec += "|| BE VALID FOR FIVE (5) YEARS  ||\n";
            rec += "|| FROM THE DATE OF THE PERMIT  ||\n";
            rec += "||            TO USE.           ||\n";
            rec += "|| ---------------------------- ||\n";
        }
        /////////////////////////////////
        ///ASK FOR THE MISSING PAYMENT///
        /////////////////////////////////
        else if (lastInp < costd) {
            try {
                changes = change + "";
                char changec = changes.charAt(3);
            } catch (Exception e) {
                changes = Math.abs(change) + "0";
            }
            content += "||     You have lack $" + changes + "      ||\n";
            content += "||        Please pay the        ||\n";
            content += "||       missing payment.       ||\n";
            willPay = true;
        }
        ///////////////////////////////////
        ///NO CHANGE NOR MISSING PAYMENT///
        ///////////////////////////////////
        else if ((change < 1 && change > -1) || change == 0) {
            content = "||\t\t\t\t||\n";
            content += "||     Balance paid exactly,    ||\n";
            content += "||   no more existing balance.  ||\n";
            content += "||          Thank you!          ||\n";
            content += "||       Have a nice day!       ||\n";

            double tnd = (Math.random() * 1000000000);
            double tndd = (Math.random() * 1000000000);
            String tns = (int) tnd + "";
            String tnss = (int) tndd + "";
            if (tns.length() < 10) {
                for (int i = 0; i <= (10 - tns.length()); i++) {
                    tns += "0";
                }
            }
            if (tnss.length() < 10) {
                for (int i = 0; i <= (10 - tnss.length()); i++) {
                    tnss += "0";
                }
            }
            ////////////////////////////////
            ///PRINTING THE ORDER RECEIPT///
            ////////////////////////////////
            int top = 0;
            String[][] orderName = {
                    {"Hotsilog", "Tocilog", "Hamdesal", "Pancake", "Bacon with Rice", "Coffee"},
                    {"Fish Pilaey", "Fried Manok", "Tokwang Tofu", "Mundo ng Menudo", "Adobong Nakaka Bobo", "Drink"},
                    {"Clubhouse Sandwich", "Ay, Scream Sandwich", "Flat Earthed Potato", "Oi Siomai", "Prinitong Noodles", "Soft drinks"},
                    {"Banana Split", "Cake Slice", "Wiggly Jelly", "Nakaka Lecheng Flan", "PACKG Salad", "Smoothie/Shake"},
            };
            int[][] orderNameLength = {
                    {7, 6, 7, 6, 14, 5},//Breakfast name length
                    {10, 10, 11, 14, 18, 4},//Heavy Meal name length
                    {17, 18, 18, 8, 16, 10},//Snacks name length
                    {11, 9, 11, 18, 10, 13}//Desserts name length
            };
            int[][] orderPrices = {
                    {100, 100, 75, 90, 125, 50},
                    {150, 100, 75, 90, 125, 25},
                    {95, 100, 110, 75, 85, 30},
                    {125, 100, 45, 135, 170, 50}
            };
            oList += "|| ____________________________ ||\n";
            oList += "|| - - - - D I N E  I N - - - - ||\n";
            for (int i = 0; i < hasOrder.length; i++) {
                if (hasOrder[i]) {
                    for (int j = 0; j < orders[i].length; j++) {
                        if (orders[i][j] > 0) {
                            //THE SPACE LEFT
                            oList += "|| ";
                            int space = 0;
                            if ((orders[i][j] > 9) && ((double) (orderPrices[i][j] * orders[i][j]) / 100) >= 10) {
                                space = 28 - (orderNameLength[i][j] + 12);
                            } else if ((orders[i][j] > 9) && (((double) (orderPrices[i][j] * orders[i][j]) / 100) < 10) || ((orders[i][j] < 10) && ((double) (orderPrices[i][j] * orders[i][j]) / 100) > 9)) {
                                space = 28 - (orderNameLength[i][j] + 11);
                            } else {
                                space = 28 - (orderNameLength[i][j] + 10);
                            }
                            //SET SOME STUFF
                            oList += orderName[i][j] + "(x" + orders[i][j] + ")";
                            //SETTING SPACE BETWEEN
                            for (int k = 1; k <= space; k++)
                                oList += " ";
                            //SETS THE CONTENT
                            double op = (((double) orderPrices[i][j] * orders[i][j]) / 100);
                            oList += "$" + String.format("%.2f", op);
                            oList += " ||\n";

                            //ADDS THE PRICE SO THAT I CAN ACCURATELY GIVE THE RECEIPT
                            for (int k = 0; k < orders[i][j]; k++)
                                top += orderPrices[i][j];
                        }
                    }
                }
            }
            oList += "||                              ||\n";
            if (realIsDiscElig) {
                if ((top / 100) < 10)
                    oList += "|| TOTAL:                 $" + String.format("%.2f", (((double) top / 100))) + " ||\n";
                else
                    oList += "|| TOTAL:                $" + String.format("%.2f", (((double) top / 100))) + " ||\n";
            } else {
                if (((top / 100) * .8) < 10)
                    oList += "|| TOTAL:                 $" + String.format("%.2f", ((double) top / 100)) + " ||\n";
                else
                    oList += "|| TOTAL:                $" + String.format("%.2f", ((double) top / 100)) + " ||\n";
            }

            if (realIsDiscElig) {
                oList += "|| ---------------------------- ||\n";
                oList += "|| Senior/Student/PWD           ||\n";
                oList += "|| discount:              $" + String.format("%.2f", (((double) top / 100) * 0.2)) + " ||\n";
                if ((top / 100) < 10)
                    oList += "|| TOTAL w/ discount:     $" + String.format("%.2f", (((double) top / 100) * .8)) + " ||\n";
                else
                    oList += "|| TOTAL w/ discount:    $" + String.format("%.2f", (((double) top / 100) * .8)) + " ||\n";
            }
            oList += "|| ---------------------------- ||\n";
            oList += "|| CHANGE:                $0.00 ||\n";
            ////////////////////////////////////
            ///PRINTING THE ORDER RECEIPT END///
            ////////////////////////////////////
            willPay = false;
            //SETS THE STRING REC VAR (LEGAL AND OFFICIAL LIKE A RECEIPT)///
            rec = "|| ---------------------------- ||\n";
            rec += "||  Transaction no. " + tns + "  ||\n"; //Transaction no. == 16
            //rec+="|| ---------------------------- ||\n";
            rec += "||      This serves as an       ||\n";
            rec += "||       OFFICIAL RECEIPT       ||\n";
            rec += "|| ACCREDITATION NO. " + tnss + " ||\n";
            rec += "||  THIS INVOICE/RECEIPT SHALL  ||\n";
            rec += "|| BE VALID FOR FIVE (5) YEARS  ||\n";
            rec += "|| FROM THE DATE OF THE PERMIT  ||\n";
            rec += "||            TO USE.           ||\n";
            rec += "|| ---------------------------- ||\n";
        }
        println(h + c + oList + rec + content + f);
        if (willPay) {
            costd = change * 100;
            cost = (int) costd;
            payment(h, c, f, false);
        }
    }

    //FOR TESTING VARIABLES
    public static boolean isEven(int n) {
        if (n % 2 == 0)
            return true;
        else
            return false;
    }

    public static boolean willOrder(String ordr) {
        switch (ordr) {
            case "Y":
            case "N":
            case "X":
            case "Z":
            case "y":
            case "n":
            case "x":
            case "z":
                return true;

            default:
                return false;
        }
    }

    public static boolean isInCategory(String ctgry) {
        switch (ctgry) {
            case "a":
            case "b":
            case "c":
            case "d":
            case "A":
            case "B":
            case "C":
            case "D":
            case "x":
            case "X":
            case "z":
            case "Z":
                return true;

            default:
                return false;
        }
    }

    public static void endP(String h, String c, String f, boolean hasName) {
        h = "O================================O\n";    //34
        h += "|| --- THANK YOU FOR TRYING --- ||\n";
        h += "|| + ____   ____   ___  __  __	||\n";    //34-4=30 -> 30/4=7.5
        h += "||+ | ___| |    | / __| \\ \\/ /	||\n";    //THUS \t\t == 15 char length
        h += "||  | ___| | /\\ | \\__ \\  \\  / + ||\n";
        h += "|| +|____| |_||_| |___/  |__|  +||\n";
        h += "||\t\t\t\t||\n";
        h += "||  +   ____    _    _____      ||\n";
        h += "||     |  []\\  | |  |_   _|   + ||\n";
        h += "||+    | ---|  | |    | |    +  ||\n";
        h += "||     |__[]/  |_|    |_|     + ||\n";
        h += "||   \"Take Everything Easy\"   + ||\n";
        h += "||\t\t\t\t||\n";
        content = "||        See you soon!         ||\n";
        f = "||\t\t\t\t||\n";
        f += "O================================O";
        if (hasName)
            println(h + c + f);
        else
            println(h + f);
    }

    //CHECKS MENU LIST
    public static class isInMenu {
        public static boolean breakfast(String mnu) {
            switch (mnu) {
                case "A":
                case "B":
                case "C":
                case "D":
                case "E":
                case "F":
                case "X":
                case "a":
                case "b":
                case "c":
                case "d":
                case "e":
                case "f":
                case "x":
                    return true;

                default:
                    return false;
            }
        }

        public static boolean heavy_meal(String mnu) {
            switch (mnu) {
                case "A":
                case "B":
                case "C":
                case "D":
                case "E":
                case "F":
                case "X":
                case "a":
                case "b":
                case "c":
                case "d":
                case "e":
                case "f":
                case "x":
                    return true;

                default:
                    return false;
            }
        }

        public static boolean snacks(String mnu) {
            switch (mnu) {
                case "A":
                case "B":
                case "C":
                case "D":
                case "E":
                case "F":
                case "X":
                case "a":
                case "b":
                case "c":
                case "d":
                case "e":
                case "f":
                case "x":
                    return true;

                default:
                    return false;
            }
        }

        public static boolean desserts(String mnu) {
            switch (mnu) {
                case "A":
                case "B":
                case "C":
                case "D":
                case "E":
                case "F":
                case "X":
                case "a":
                case "b":
                case "c":
                case "d":
                case "e":
                case "f":
                case "x":
                    return true;

                default:
                    return false;
            }
        }
    }
}
