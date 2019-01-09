package com.company;

public class Main {

    public static void main(String[] args) {
        int a = 100;
        if (a ==100) System.out.println("Perfect!");
        else if (a > 100) System.out.println("ERROR");
        else if (a >= 90) System.out.println("90-99");
        else if (a >= 80) System.out.println("80-89");
        else if (a >= 70) System.out.println("70-79");

        else System.out.println("you Failed!");
    }
}