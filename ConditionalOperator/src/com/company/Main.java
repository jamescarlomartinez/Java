package com.company;

public class Main {

    public static void main(String[] args) {
        int a, b;
        a = 51;

        // format is variable = (expression) ? value if true : value if false

        b = (a == 5) ? 10: 20; // the value here is false so it will display 20
        System.out.println("the value of b is :" + b);

        b = ( a >= 50) ? 100 : 0;// the value here is true so it will display 100
        System.out.println("the value of b is :" + b);

    }
}
